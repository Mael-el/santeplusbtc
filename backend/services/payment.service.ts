// ============================================================================
// SERVICE PAIEMENT UNIFIÉ SANTÉ+ BÉNIN (Production Ready)
// Orchestre wallet_recharges, invoices, payment_transactions & wallet_accounts
// Transactions atomiques + idempotence stricte + validation montants
// ============================================================================

import crypto from 'crypto';
import dbService from './db.service';
import type { PoolClient } from 'pg';

export type RechargeStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type InvoiceStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
export type PaymentMethod = 'mobile_money' | 'lightning' | 'wallet';
export type MobileProvider = 'mtn' | 'moov' | 'celtiis' | 'lnbits' | 'sandbox';
export type TxType = 'recharge' | 'invoice' | 'refund';
export type TxStatus = 'pending' | 'confirmed' | 'failed' | 'refunded';

export interface InvoiceItem {
  label: string;
  quantity?: number;
  unit_price_xof: number;
}

export interface CreateWalletRechargeInput {
  patientId: number;
  amountXof: number;
  amountSats?: number;
  method: PaymentMethod;
  provider: MobileProvider;
  metadata?: Record<string, any>;
}

export interface CreateInvoiceInput {
  patientId: number;
  doctorId: number;
  hospitalId?: number;
  consultationId?: number;
  items: InvoiceItem[];
}

export interface PayInvoiceInput {
  invoiceId: string;
  patientId: number;
  method: PaymentMethod;
  provider?: MobileProvider;
}

const MAX_XOF = 100_000_000;
const MIN_XOF = 1;

class PaymentService {
  // ================================================================
  // VALIDATION GÉNÉRIQUE
  // ================================================================
  private validateAmount(amountXof: number, label = 'Montant'): void {
    if (!Number.isFinite(amountXof) || !Number.isInteger(amountXof)) {
      throw new Error(`${label} invalide : entier attendu`);
    }
    if (amountXof < MIN_XOF || amountXof > MAX_XOF) {
      throw new Error(`${label} doit être compris entre ${MIN_XOF} et ${MAX_XOF.toLocaleString()} FCFA`);
    }
  }

  // ================================================================
  // WALLET : CRÉATION D'UNE DEMANDE DE RECHARGE
  // ================================================================
  public async createWalletRecharge(input: CreateWalletRechargeInput): Promise<{
    rechargeId: string;
    amountXof: number;
    status: RechargeStatus;
  }> {
    this.validateAmount(input.amountXof, 'Montant de recharge');
    if (input.method !== 'mobile_money' && input.method !== 'lightning') {
      throw new Error('Méthode de recharge invalide');
    }

    const result = await dbService.transaction(async (client) => {
      const insertRecharge = `
        INSERT INTO wallet_recharges
          (patient_id, amount_xof, amount_sats, method, provider, status, metadata)
        VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
        RETURNING id, amount_xof, status
      `;
      const res = await client.query(insertRecharge, [
        input.patientId,
        input.amountXof,
        input.amountSats ?? null,
        input.method,
        input.provider,
        input.metadata ?? null,
      ]);
      const row = res.rows[0];

      const insertTx = `
        INSERT INTO payment_transactions
          (patient_id, type, reference_id, amount_xof, amount_sats, method, provider, status)
        VALUES ($1, 'recharge', $2, $3, $4, $5, $6, 'pending')
        RETURNING id
      `;
      await client.query(insertTx, [
        input.patientId,
        row.id,
        input.amountXof,
        input.amountSats ?? null,
        input.method,
        input.provider,
      ]);

      return { rechargeId: row.id, amountXof: row.amount_xof, status: row.status as RechargeStatus };
    });

    if (!result) throw new Error('Base de données indisponible');
    return result;
  }

  // ================================================================
  // WALLET : CONFIRMATION DE RECHARGE (IDEMPOTENTE + ATOMIQUE)
  // ================================================================
  public async confirmRechargeByTransactionId(params: {
    transactionId?: string;
    paymentHash?: string;
    amountXof: number;
    externalStatus: 'SUCCESS' | 'FAILED';
    provider: MobileProvider;
    completedAt?: Date;
  }): Promise<{ success: boolean; alreadyProcessed: boolean; rechargeId?: string; newBalance?: number }> {
    const { transactionId, paymentHash, amountXof, externalStatus, provider } = params;
    if (!transactionId && !paymentHash) throw new Error('transactionId ou paymentHash requis');

    this.validateAmount(amountXof, 'Montant');
    const targetStatus: RechargeStatus = externalStatus === 'SUCCESS' ? 'COMPLETED' : 'FAILED';
    const txStatus: TxStatus = externalStatus === 'SUCCESS' ? 'confirmed' : 'failed';

    const result = await dbService.transaction(async (client) => {
      // 1. Récupérer la recharge (LOCK row pour éviter race)
      const findRechargeSql = transactionId
        ? `SELECT * FROM wallet_recharges WHERE transaction_id = $1 FOR UPDATE`
        : `SELECT * FROM wallet_recharges WHERE payment_hash = $1 FOR UPDATE`;
      const findRechargeArgs = [transactionId || paymentHash];
      const recharges = await client.query(findRechargeSql, findRechargeArgs);

      if (recharges.rows.length === 0) {
        // On essaye par payment_hash fallback si on a utilisé transaction_id
        if (transactionId && paymentHash) {
          const r2 = await client.query(`SELECT * FROM wallet_recharges WHERE payment_hash = $1 FOR UPDATE`, [paymentHash]);
          if (r2.rows.length === 0) throw new Error('Recharge introuvable');
          recharges.rows = r2.rows;
        } else {
          throw new Error('Recharge introuvable');
        }
      }
      const recharge = recharges.rows[0];

      // 2. Idempotence : déjà dans le statut cible → rien faire
      if (recharge.status === targetStatus || recharge.status === 'REFUNDED') {
        const balance = await this.getPatientWalletBalanceInternal(client, recharge.patient_id);
        return { success: true, alreadyProcessed: true, rechargeId: recharge.id, newBalance: balance };
      }

      // Éviter repasser de FAILED → COMPLETED si jamais déjà FAILED
      if (recharge.status === 'FAILED' && targetStatus === 'COMPLETED') {
        throw new Error('Recharge déjà marquée FAILED');
      }

      // 3. Vérifier que le montant correspond (tolérance 0 FCFA - exact)
      if (recharge.amount_xof !== amountXof) {
        throw new Error('Montant du webhook ne correspond pas à la recharge');
      }

      // 4. Mettre à jour la recharge
      const completedAt = params.completedAt ?? new Date();
      await client.query(
        `UPDATE wallet_recharges
         SET status = $1, completed_at = $2, transaction_id = COALESCE($3, transaction_id), payment_hash = COALESCE($4, payment_hash)
         WHERE id = $5`,
        [targetStatus, completedAt, transactionId ?? null, paymentHash ?? null, recharge.id]
      );

      // 5. Mettre à jour payment_transactions
      await client.query(
        `UPDATE payment_transactions
         SET status = $1, confirmed_at = $2, completed_at = $2,
             transaction_id = COALESCE($3, transaction_id),
             payment_hash = COALESCE($4, payment_hash)
         WHERE reference_id = $5 AND type = 'recharge'`,
        [txStatus, completedAt, transactionId ?? null, paymentHash ?? null, recharge.id]
      );

      let newBalance: number | undefined;

      // 6. Seulement si SUCCESS : créditer wallet_accounts + créer wallet_transactions
      if (targetStatus === 'COMPLETED') {
        const patient = await client.query(
          `SELECT user_id FROM patients WHERE id = $1`,
          [recharge.patient_id]
        );
        if (patient.rows.length === 0) throw new Error('Patient introuvable');
        const userId = patient.rows[0].user_id;

        // Récup ou créer wallet_account
        let wallet = await client.query(
          `SELECT * FROM wallet_accounts WHERE user_id = $1 FOR UPDATE`,
          [userId]
        );
        if (wallet.rows.length === 0) {
          await client.query(
            `INSERT INTO wallet_accounts (user_id, balance_xof, balance_sats, currency)
             VALUES ($1, 0, 0, 'XOF')`,
            [userId]
          );
          wallet = await client.query(
            `SELECT * FROM wallet_accounts WHERE user_id = $1 FOR UPDATE`,
            [userId]
          );
        }
        const wa = wallet.rows[0];
        const amountSats = recharge.amount_sats ?? 0;
        const newBalanceXof = Number(wa.balance_xof) + recharge.amount_xof;
        const newBalanceSats = Number(wa.balance_sats) + amountSats;

        await client.query(
          `UPDATE wallet_accounts SET balance_xof = $1, balance_sats = $2, updated_at = NOW() WHERE id = $3`,
          [newBalanceXof, newBalanceSats, wa.id]
        );
        newBalance = newBalanceXof;

        const ref = `RECHARGE-${recharge.id}`;
        let ptx = await client.query(
          `SELECT id FROM payment_transactions WHERE reference_id = $1 AND type = 'recharge' LIMIT 1`,
          [recharge.id]
        );
        const ptxId = ptx.rows[0]?.id ?? null;

        await client.query(
          `INSERT INTO wallet_transactions
             (wallet_id, payment_transaction_id, direction, amount_xof, amount_sats, balance_after_xof, reference)
           VALUES ($1, $2, 'credit', $3, $4, $5, $6)
           ON CONFLICT (reference) DO NOTHING`,
          [wa.id, ptxId, recharge.amount_xof, amountSats, newBalanceXof, ref]
        );
      }

      return { success: true, alreadyProcessed: false, rechargeId: recharge.id, newBalance };
    });

    if (!result) throw new Error('Base de données indisponible');
    return result;
  }

  // ================================================================
  // FACTURES : CRÉATION PAR LE MÉDECIN (avec hash SHA-256)
  // ================================================================
  public async createInvoice(input: CreateInvoiceInput): Promise<{
    id: string;
    totalXof: number;
    status: InvoiceStatus;
    hash: string;
  }> {
    if (!input.items || input.items.length === 0) throw new Error('Facture sans items');
    let total = 0;
    for (const it of input.items) {
      if (!it.label?.trim()) throw new Error('Item facture : label obligatoire');
      const qty = it.quantity ?? 1;
      if (!Number.isInteger(qty) || qty < 1) throw new Error('Quantité invalide');
      this.validateAmount(it.unit_price_xof, `Prix de ${it.label}`);
      total += qty * it.unit_price_xof;
      this.validateAmount(total, 'Total facture');
    }

    // Générer ID + hash immuable
    const id = `INV-BJ-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const hashMaterial = `${id}|${input.patientId}|${input.doctorId}|${total}|${JSON.stringify(input.items)}|${crypto.randomBytes(16).toString('hex')}`;
    const hash = crypto.createHash('sha256').update(hashMaterial).digest('hex');

    const result = await dbService.transaction(async (client) => {
      const insert = `
        INSERT INTO invoices
          (id, patient_id, doctor_id, hospital_id, consultation_id, items, total_xof, hash, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
        RETURNING id, total_xof, status, hash
      `;
      const ins = await client.query(insert, [
        id,
        input.patientId,
        input.doctorId,
        input.hospitalId ?? null,
        input.consultationId ?? null,
        JSON.stringify(input.items),
        total,
        hash,
      ]);
      const row = ins.rows[0];

      await client.query(
        `INSERT INTO payment_transactions
           (patient_id, type, reference_id, amount_xof, method, provider, status, metadata)
         VALUES ($1, 'invoice', $2, $3, NULL, NULL, 'pending', $4)`,
        [input.patientId, id, total, JSON.stringify({ invoiceId: id, hash })]
      );

      return { id: row.id, totalXof: row.total_xof, status: row.status as InvoiceStatus, hash: row.hash };
    });

    if (!result) throw new Error('Base de données indisponible');
    return result;
  }

  // ================================================================
  // FACTURES : PAIEMENT (cas wallet interne, sinon retourner demande d'init)
  // ================================================================
  public async payInvoice(input: PayInvoiceInput): Promise<{
    success: boolean;
    status: InvoiceStatus;
    paidAt?: Date;
    newBalance?: number;
    needsExternalInit?: boolean;
    errorCode?: 'INSUFFICIENT_BALANCE' | 'NOT_FOUND' | 'ALREADY_PAID';
  }> {
    const result = await dbService.transaction(async (client) => {
      const inv = await client.query(
        `SELECT * FROM invoices WHERE id = $1 FOR UPDATE`,
        [input.invoiceId]
      );
      if (inv.rows.length === 0) return { success: false, status: 'FAILED' as InvoiceStatus, errorCode: 'NOT_FOUND' as const };
      const invoice = inv.rows[0];

      if (invoice.status === 'PAID') return { success: true, status: 'PAID' as InvoiceStatus, paidAt: invoice.paid_at, alreadyPaid: true };
      if (invoice.patient_id !== input.patientId) return { success: false, status: 'FAILED' as InvoiceStatus, errorCode: 'NOT_FOUND' as const };

      // Wallet interne : on débite tout de suite
      if (input.method === 'wallet') {
        const patient = await client.query(`SELECT user_id FROM patients WHERE id = $1`, [invoice.patient_id]);
        if (patient.rows.length === 0) return { success: false, status: 'FAILED' as InvoiceStatus, errorCode: 'NOT_FOUND' as const };
        const userId = patient.rows[0].user_id;

        const wallet = await client.query(
          `SELECT * FROM wallet_accounts WHERE user_id = $1 FOR UPDATE`,
          [userId]
        );
        const wa = wallet.rows[0];
        const balance = wa ? Number(wa.balance_xof) : 0;
        if (balance < invoice.total_xof) {
          return { success: false, status: 'PENDING' as InvoiceStatus, errorCode: 'INSUFFICIENT_BALANCE' as const, needsExternalInit: false };
        }

        // On débite
        const newBalanceXof = balance - invoice.total_xof;
        await client.query(
          `UPDATE wallet_accounts SET balance_xof = $1, updated_at = NOW() WHERE id = $2`,
          [newBalanceXof, wa.id]
        );

        const paidAt = new Date();
        await client.query(
          `UPDATE invoices SET status = 'PAID', paid_at = $1, payment_method = 'wallet', updated_at = NOW() WHERE id = $2`,
          [paidAt, invoice.id]
        );

        let ptx = await client.query(
          `SELECT id FROM payment_transactions WHERE reference_id::text = $1 AND type = 'invoice' LIMIT 1`,
          [invoice.id]
        );
        const ptxId = ptx.rows[0]?.id ?? null;

        await client.query(
          `UPDATE payment_transactions
           SET status = 'confirmed', method = 'wallet', provider = 'wallet',
               confirmed_at = $1, completed_at = $1
           WHERE reference_id::text = $2 AND type = 'invoice'`,
          [paidAt, invoice.id]
        );

        const ref = `INVOICE-${invoice.id}`;
        await client.query(
          `INSERT INTO wallet_transactions
             (wallet_id, payment_transaction_id, direction, amount_xof, amount_sats, balance_after_xof, reference)
           VALUES ($1, $2, 'debit', $3, 0, $4, $5)
           ON CONFLICT (reference) DO NOTHING`,
          [wa.id, ptxId, invoice.total_xof, newBalanceXof, ref]
        );

        return { success: true, status: 'PAID' as InvoiceStatus, paidAt, newBalance: newBalanceXof, needsExternalInit: false };
      }

      // mobile_money ou lightning : marquer la méthode sur invoice + ptx, retourner needsExternalInit
      const provider = input.provider ?? (input.method === 'lightning' ? 'lnbits' : 'sandbox');
      await client.query(
        `UPDATE invoices SET payment_method = $1, updated_at = NOW() WHERE id = $2`,
        [input.method, invoice.id]
      );
      await client.query(
        `UPDATE payment_transactions SET method = $1, provider = $2 WHERE reference_id::text = $3 AND type = 'invoice'`,
        [input.method, provider, invoice.id]
      );
      return { success: true, status: 'PENDING' as InvoiceStatus, needsExternalInit: true };
    });

    if (!result) throw new Error('Base de données indisponible');
    return result as any;
  }

  // ================================================================
  // FACTURES : CONFIRMATION PAR WEBHOOK/POLLING EXTERNE
  // ================================================================
  public async confirmInvoicePayment(params: {
    invoiceId?: string;
    transactionId?: string;
    paymentHash?: string;
    amountXof: number;
    externalStatus: 'SUCCESS' | 'FAILED';
    method: PaymentMethod;
    provider: MobileProvider;
  }): Promise<{ success: boolean; alreadyProcessed: boolean; invoiceId?: string; paidAt?: Date }> {
    const { transactionId, paymentHash, amountXof, externalStatus, method, provider } = params;
    if (!params.invoiceId && !transactionId && !paymentHash) throw new Error('Référence facture manquante');
    this.validateAmount(amountXof, 'Montant facture');
    const invoiceStatus: InvoiceStatus = externalStatus === 'SUCCESS' ? 'PAID' : 'FAILED';
    const txStatus: TxStatus = externalStatus === 'SUCCESS' ? 'confirmed' : 'failed';

    const result = await dbService.transaction(async (client) => {
      let invoice;
      if (params.invoiceId) {
        const r = await client.query(`SELECT * FROM invoices WHERE id = $1 FOR UPDATE`, [params.invoiceId]);
        invoice = r.rows[0];
      }
      if (!invoice && paymentHash) {
        const r = await client.query(`SELECT * FROM invoices WHERE payment_hash = $1 FOR UPDATE`, [paymentHash]);
        invoice = r.rows[0];
      }
      if (!invoice && transactionId) {
        const ptx = await client.query(
          `SELECT reference_id FROM payment_transactions WHERE transaction_id = $1 AND type = 'invoice' LIMIT 1`,
          [transactionId]
        );
        if (ptx.rows[0]) {
          const r = await client.query(`SELECT * FROM invoices WHERE id = $1 FOR UPDATE`, [ptx.rows[0].reference_id]);
          invoice = r.rows[0];
        }
      }
      if (!invoice) throw new Error('Facture introuvable');

      if (invoice.status === invoiceStatus || invoice.status === 'REFUNDED') {
        return { success: true, alreadyProcessed: true, invoiceId: invoice.id, paidAt: invoice.paid_at };
      }
      if (invoice.status === 'FAILED' && invoiceStatus === 'PAID') {
        throw new Error('Facture déjà marquée FAILED');
      }
      if (invoice.total_xof !== amountXof) {
        throw new Error('Montant du webhook ne correspond pas à la facture');
      }

      const paidAt = new Date();
      const updateSql = externalStatus === 'SUCCESS'
        ? `UPDATE invoices SET status = 'PAID', paid_at = $1, payment_method = $2, payment_hash = COALESCE($3, payment_hash), updated_at = NOW() WHERE id = $4`
        : `UPDATE invoices SET status = 'FAILED', updated_at = NOW() WHERE id = $4`;
      await client.query(updateSql, [paidAt, method, paymentHash ?? null, invoice.id]);

      await client.query(
        `UPDATE payment_transactions
         SET status = $1, method = $2, provider = $3,
             confirmed_at = $4, completed_at = $4,
             transaction_id = COALESCE($5, transaction_id),
             payment_hash = COALESCE($6, payment_hash)
         WHERE reference_id::text = $7 AND type = 'invoice'`,
        [txStatus, method, provider, paidAt, transactionId ?? null, paymentHash ?? null, invoice.id]
      );

      return { success: true, alreadyProcessed: false, invoiceId: invoice.id, paidAt };
    });

    if (!result) throw new Error('Base de données indisponible');
    return result;
  }

  // ================================================================
  // WALLET : LECTURE SOLDE
  // ================================================================
  public async getPatientWalletBalance(patientId: number): Promise<number> {
    const res = await dbService.query<any>(
      `SELECT COALESCE(wa.balance_xof, 0) AS balance
       FROM patients p
       LEFT JOIN wallet_accounts wa ON wa.user_id = p.user_id
       WHERE p.id = $1`,
      [patientId]
    );
    if (!res || res.rows.length === 0) return 0;
    return Number(res.rows[0].balance) || 0;
  }

  private async getPatientWalletBalanceInternal(client: PoolClient, patientId: number): Promise<number> {
    const r = await client.query(
      `SELECT COALESCE(wa.balance_xof, 0) AS balance
       FROM patients p LEFT JOIN wallet_accounts wa ON wa.user_id = p.user_id WHERE p.id = $1`,
      [patientId]
    );
    return Number(r.rows[0]?.balance) || 0;
  }

  // ================================================================
  // WALLET : HISTORIQUE RECHARGES
  // ================================================================
  public async getWalletRecharges(patientId: number, limit = 50): Promise<any[]> {
    const res = await dbService.query<any>(
      `SELECT id, amount_xof, amount_sats, method, provider, status, transaction_id, created_at, completed_at
       FROM wallet_recharges WHERE patient_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [patientId, limit]
    );
    return res?.rows ?? [];
  }

  // ================================================================
  // FACTURES : LECTURE
  // ================================================================
  public async getInvoice(invoiceId: string): Promise<any | null> {
    const res = await dbService.query<any>(`SELECT * FROM invoices WHERE id = $1`, [invoiceId]);
    return res?.rows[0] ?? null;
  }

  public async getInvoicesForPatient(patientId: number, limit = 50): Promise<any[]> {
    const res = await dbService.query<any>(
      `SELECT * FROM invoices WHERE patient_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [patientId, limit]
    );
    return res?.rows ?? [];
  }

  public async getInvoicesForDoctor(doctorId: number, limit = 50): Promise<any[]> {
    const res = await dbService.query<any>(
      `SELECT * FROM invoices WHERE doctor_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [doctorId, limit]
    );
    return res?.rows ?? [];
  }
}

export const paymentService = new PaymentService();
export default paymentService;
