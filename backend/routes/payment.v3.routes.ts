// ============================================================================
// ROUTES API V3 - PAIEMENT SANTÉ+ BÉNIN (Production)
// POST   /api/wallet/recharge       — Initier recharge wallet patient
// GET    /api/wallet/balance        — Lire solde wallet patient
// GET    /api/wallet/recharges      — Historique recharges
// POST   /api/invoices              — Créer facture (médecin)
// GET    /api/invoices              — Lister factures (patient/doctor)
// GET    /api/invoices/:id          — Détail facture
// POST   /api/invoices/:id/pay      — Payer facture (5 méthodes)
// GET    /api/invoices/:id/status   — Statut paiement (polling)
// ============================================================================

import { Router, Response } from 'express';
import crypto from 'crypto';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.middleware';
import { paymentService, type CreateWalletRechargeInput } from '../services/payment.service';
import { momoService, type FiatProvider } from '../services/momo.service';
import { lightningService } from '../services/lightning.service';
import { dbService } from '../services/db.service';

const router = Router();

// ---------- Helpers ----------
function ok<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ success: true, data });
}
function fail(res: Response, error: string, status = 400) {
  return res.status(status).json({ success: false, error });
}

async function getPatientIdFromUserId(userId: number): Promise<number | null> {
  const r = await dbService.query<{ id: number }>(
    `SELECT id FROM patients WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return r?.rows[0]?.id ?? null;
}

async function getDoctorIdFromUserId(userId: number): Promise<number | null> {
  const r = await dbService.query<{ id: number }>(
    `SELECT id FROM doctors WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return r?.rows[0]?.id ?? null;
}

const PROVIDER_MAP: Record<string, 'mtn' | 'moov' | 'celtiis' | 'lnbits' | 'sandbox'> = {
  mtn: 'mtn', moov: 'moov', celtiis: 'celtiis', lightning: 'lnbits', lnbits: 'lnbits', wallet: 'sandbox',
};

// ============================================================================
// WALLET PATIENT (routes nécessitant patient)
// ============================================================================
router.post('/wallet/recharge', requireAuth, requireRole('patient'), async (req: AuthRequest, res) => {
  try {
    const patientId = await getPatientIdFromUserId(req.userId!);
    if (!patientId) return fail(res, 'Patient introuvable', 404);

    const { amountXof, method, provider, phone } = req.body as {
      amountXof: number; method: string; provider?: string; phone?: string;
    };

    if (!Number.isInteger(amountXof) || amountXof < 100 || amountXof > 100_000_000) {
      return fail(res, 'Montant invalide (100 – 100 000 000 FCFA)');
    }

    const payMethod: 'mobile_money' | 'lightning' =
      method === 'lightning' ? 'lightning' : 'mobile_money';
    const prov = (provider && PROVIDER_MAP[provider]) ? PROVIDER_MAP[provider]
      : payMethod === 'lightning' ? 'lnbits'
      : phone ? (PROVIDER_MAP[momoService.detectOperator(phone)] || 'sandbox') : 'sandbox';

    const input: CreateWalletRechargeInput = {
      patientId,
      amountXof,
      method: payMethod,
      provider: prov,
    };
    if (payMethod === 'lightning') {
      const rate = (await lightningService.getXofToSatsRate()).rate;
      input.amountSats = lightningService.xofToSats(amountXof, rate);
    }
    const created = await paymentService.createWalletRecharge(input);

    // Initier paiement externe
    if (payMethod === 'mobile_money') {
      if (!phone) return fail(res, 'Numéro de téléphone obligatoire pour Mobile Money');
      const init = await momoService.initializePayment({
        amount: amountXof,
        phone,
        description: `Recharge wallet Santé+ ${amountXof.toLocaleString()} FCFA`,
        transactionId: created.rechargeId,
        metadata: { kind: 'wallet_recharge', rechargeId: created.rechargeId, patientId },
      });
      // Stocker l'ID de transaction externe dans la recharge
      await dbService.query(
        `UPDATE wallet_recharges SET transaction_id = $1, metadata = COALESCE(metadata::jsonb, '{}'::jsonb) || $2::jsonb WHERE id = $3`,
        [init.reference, JSON.stringify({ momoReference: init.reference, paymentUrl: init.paymentUrl, operator: init.operatorHint }), created.rechargeId]
      );
      await dbService.query(
        `UPDATE payment_transactions SET transaction_id = $1 WHERE reference_id = $2 AND type = 'recharge'`,
        [init.reference, created.rechargeId]
      );
      return ok(res, {
        rechargeId: created.rechargeId,
        status: created.status,
        amountXof,
        method: payMethod,
        provider: prov,
        momo: init,
      }, 201);
    }

    // Lightning : créer invoice BOLT11
    const inv = await lightningService.createInvoiceWithConversion(
      amountXof,
      `Recharge wallet Santé+ ${amountXof.toLocaleString()} FCFA`
    );
    await dbService.query(
      `UPDATE wallet_recharges SET payment_hash = $1, amount_sats = $2, metadata = COALESCE(metadata::jsonb, '{}'::jsonb) || $3::jsonb WHERE id = $4`,
      [inv.paymentHash, inv.amountSats, JSON.stringify({ bolt11: inv.invoice, invoiceId: inv.invoiceId, rateApplied: inv.rateApplied }), created.rechargeId]
    );
    await dbService.query(
      `UPDATE payment_transactions SET payment_hash = $1, amount_sats = $2 WHERE reference_id = $3 AND type = 'recharge'`,
      [inv.paymentHash, inv.amountSats, created.rechargeId]
    );
    return ok(res, {
      rechargeId: created.rechargeId,
      status: created.status,
      amountXof,
      amountSats: inv.amountSats,
      method: payMethod,
      provider: prov,
      lightning: { bolt11: inv.invoice, paymentHash: inv.paymentHash, expiresAt: inv.expiresAt, rateApplied: inv.rateApplied, isLive: inv.isLive },
    }, 201);
  } catch (err: any) {
    return fail(res, err.message || 'Erreur recharge', 500);
  }
});

router.get('/wallet/balance', requireAuth, requireRole('patient', 'admin', 'superadmin'), async (req: AuthRequest, res) => {
  try {
    const patientId = await getPatientIdFromUserId(req.userId!);
    if (!patientId) return fail(res, 'Patient introuvable', 404);
    const balance = await paymentService.getPatientWalletBalance(patientId);
    return ok(res, { balance_xof: balance, currency: 'XOF' });
  } catch (err: any) {
    return fail(res, err.message || 'Erreur solde', 500);
  }
});

router.get('/wallet/recharges', requireAuth, requireRole('patient'), async (req: AuthRequest, res) => {
  try {
    const patientId = await getPatientIdFromUserId(req.userId!);
    if (!patientId) return fail(res, 'Patient introuvable', 404);
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const list = await paymentService.getWalletRecharges(patientId, limit);
    return ok(res, list);
  } catch (err: any) {
    return fail(res, err.message || 'Erreur historique', 500);
  }
});

// ============================================================================
// FACTURES
// ============================================================================
router.post('/invoices', requireAuth, requireRole('doctor', 'admin', 'superadmin'), async (req: AuthRequest, res) => {
  try {
    const doctorId = await getDoctorIdFromUserId(req.userId!);
    if (!doctorId && !['admin', 'superadmin'].includes(req.userRole || '')) {
      return fail(res, 'Compte médecin introuvable', 404);
    }
    const { patientId, items, hospitalId, consultationId } = req.body as {
      patientId: number; items: any[]; hospitalId?: number; consultationId?: number;
    };
    if (!patientId || !Array.isArray(items) || items.length === 0) {
      return fail(res, 'Facture invalide : patientId et items requis');
    }
    const drId = doctorId || 0;
    const inv = await paymentService.createInvoice({
      patientId, doctorId: drId, hospitalId, consultationId,
      items: items.map(it => ({
        label: String(it.label || it.name || 'Acte'),
        quantity: Number(it.quantity || 1),
        unit_price_xof: Number(it.unit_price_xof ?? it.priceXof ?? it.price ?? 0),
      })),
    });
    return ok(res, inv, 201);
  } catch (err: any) {
    return fail(res, err.message || 'Erreur création facture', 500);
  }
});

router.get('/invoices', requireAuth, requireRole('patient', 'doctor', 'admin', 'superadmin'), async (req: AuthRequest, res) => {
  try {
    const role = req.userRole || '';
    const limit = Math.min(100, Number(req.query.limit) || 50);
    if (role === 'patient') {
      const pid = await getPatientIdFromUserId(req.userId!);
      if (!pid) return fail(res, 'Patient introuvable', 404);
      return ok(res, await paymentService.getInvoicesForPatient(pid, limit));
    }
    const did = await getDoctorIdFromUserId(req.userId!);
    if (did) return ok(res, await paymentService.getInvoicesForDoctor(did, limit));
    // admin
    const r = await dbService.query<any>(`SELECT * FROM invoices ORDER BY created_at DESC LIMIT $1`, [limit]);
    return ok(res, r?.rows ?? []);
  } catch (err: any) {
    return fail(res, err.message || 'Erreur liste factures', 500);
  }
});

router.get('/invoices/:id', requireAuth, requireRole('patient', 'doctor', 'admin', 'superadmin'), async (req: AuthRequest, res) => {
  try {
    const inv = await paymentService.getInvoice(req.params.id);
    if (!inv) return fail(res, 'Facture introuvable', 404);
    const role = req.userRole || '';
    if (role === 'patient') {
      const pid = await getPatientIdFromUserId(req.userId!);
      if (pid !== inv.patient_id) return fail(res, 'Accès refusé', 403);
    } else if (role === 'doctor') {
      const did = await getDoctorIdFromUserId(req.userId!);
      if (did !== inv.doctor_id) return fail(res, 'Accès refusé', 403);
    }
    return ok(res, inv);
  } catch (err: any) {
    return fail(res, err.message || 'Erreur lecture facture', 500);
  }
});

router.post('/invoices/:id/pay', requireAuth, requireRole('patient'), async (req: AuthRequest, res) => {
  try {
    const patientId = await getPatientIdFromUserId(req.userId!);
    if (!patientId) return fail(res, 'Patient introuvable', 404);

    const inv = await paymentService.getInvoice(req.params.id);
    if (!inv) return fail(res, 'Facture introuvable', 404);
    if (inv.patient_id !== patientId) return fail(res, 'Accès refusé', 403);

    const { method, provider, phone } = req.body as { method: string; provider?: string; phone?: string };

    const payMethod: 'wallet' | 'mobile_money' | 'lightning' =
      method === 'wallet' ? 'wallet'
      : method === 'lightning' ? 'lightning'
      : 'mobile_money';
    const prov = payMethod === 'wallet' ? 'sandbox'
      : payMethod === 'lightning' ? 'lnbits'
      : (provider && PROVIDER_MAP[provider]) ? PROVIDER_MAP[provider]
      : phone ? (PROVIDER_MAP[momoService.detectOperator(phone)] || 'sandbox')
      : 'sandbox';

    // Wallet interne : paiement immédiat
    if (payMethod === 'wallet') {
      const r = await paymentService.payInvoice({ invoiceId: req.params.id, patientId, method: 'wallet' });
      if (r.errorCode === 'INSUFFICIENT_BALANCE') {
        return fail(res, 'Solde wallet insuffisant. Veuillez recharger votre compte ou choisir un autre moyen de paiement.', 402);
      }
      if (r.errorCode === 'NOT_FOUND') return fail(res, 'Facture introuvable', 404);
      return ok(res, {
        invoiceId: req.params.id,
        status: r.status,
        paidAt: r.paidAt,
        newBalance: r.newBalance,
        method: 'wallet',
      });
    }

    // Marquer la facture comme paiement externe initié
    const init = await paymentService.payInvoice({
      invoiceId: req.params.id, patientId, method: payMethod, provider: prov,
    });
    if (init.errorCode) return fail(res, 'Paiement impossible', 400);

    if (payMethod === 'mobile_money') {
      if (!phone) return fail(res, 'Numéro de téléphone obligatoire pour Mobile Money');
      const momo = await momoService.initializePayment({
        amount: inv.total_xof,
        phone,
        description: `Facture Santé+ ${req.params.id} ${Number(inv.total_xof).toLocaleString()} FCFA`,
        transactionId: `INV-${req.params.id}-${crypto.randomBytes(3).toString('hex')}`,
        metadata: { kind: 'invoice_payment', invoiceId: req.params.id, patientId },
      });
      await dbService.query(
        `UPDATE invoices SET payment_hash = NULL WHERE id = $1`,
        [req.params.id]
      );
      await dbService.query(
        `UPDATE payment_transactions SET transaction_id = $1, method = 'mobile_money', provider = $2 WHERE reference_id::text = $3 AND type = 'invoice'`,
        [momo.reference, prov, req.params.id]
      );
      return ok(res, {
        invoiceId: req.params.id,
        status: 'PENDING',
        method: payMethod,
        provider: prov,
        momo,
      }, 200);
    }

    // Lightning
    const ln = await lightningService.createInvoiceWithConversion(
      inv.total_xof,
      `Facture Santé+ ${req.params.id}`
    );
    await dbService.query(
      `UPDATE invoices SET payment_hash = $1, total_sats = $2 WHERE id = $3`,
      [ln.paymentHash, ln.amountSats, req.params.id]
    );
    await dbService.query(
      `UPDATE payment_transactions SET payment_hash = $1, amount_sats = $2, method = 'lightning', provider = 'lnbits' WHERE reference_id::text = $3 AND type = 'invoice'`,
      [ln.paymentHash, ln.amountSats, req.params.id]
    );
    return ok(res, {
      invoiceId: req.params.id,
      status: 'PENDING',
      method: payMethod,
      provider: 'lnbits',
      lightning: { bolt11: ln.invoice, paymentHash: ln.paymentHash, expiresAt: ln.expiresAt, amountSats: ln.amountSats, rateApplied: ln.rateApplied, isLive: ln.isLive },
    }, 200);
  } catch (err: any) {
    return fail(res, err.message || 'Erreur paiement facture', 500);
  }
});

router.get('/invoices/:id/status', requireAuth, requireRole('patient', 'doctor', 'admin', 'superadmin'), async (req: AuthRequest, res) => {
  try {
    const inv = await paymentService.getInvoice(req.params.id);
    if (!inv) return fail(res, 'Facture introuvable', 404);
    const role = req.userRole || '';
    if (role === 'patient') {
      const pid = await getPatientIdFromUserId(req.userId!);
      if (pid !== inv.patient_id) return fail(res, 'Accès refusé', 403);
    } else if (role === 'doctor') {
      const did = await getDoctorIdFromUserId(req.userId!);
      if (did !== inv.doctor_id) return fail(res, 'Accès refusé', 403);
    }
    // Si Lightning pending : vérifier statut en temps réel
    let lightningPaid = false;
    if (inv.status === 'PENDING' && inv.payment_method === 'lightning' && inv.payment_hash) {
      const st = await lightningService.checkPaymentStatus(inv.payment_hash);
      if (st.paid) {
        lightningPaid = true;
        try {
          await paymentService.confirmInvoicePayment({
            invoiceId: req.params.id,
            paymentHash: inv.payment_hash,
            amountXof: inv.total_xof,
            externalStatus: 'SUCCESS',
            method: 'lightning',
            provider: 'lnbits',
          });
          inv.status = 'PAID';
        } catch {/* ignore double */}
      }
    }
    return ok(res, {
      id: inv.id,
      status: inv.status,
      totalXof: inv.total_xof,
      paymentMethod: inv.payment_method,
      paidAt: inv.paid_at,
      paymentHash: inv.payment_hash,
      lightningPaid,
    });
  } catch (err: any) {
    return fail(res, err.message || 'Erreur statut facture', 500);
  }
});

export default router;
