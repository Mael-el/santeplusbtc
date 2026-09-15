// ============================================================================
// SERVICE PAIEMENT MOBILE MONEY BÉNIN (Multi-Agrégateur Production)
// MTN Mobile Money, Moov Money, Celtiis Cash via CinetPay | Kkiapay | FeexPay | FedaPay
// Initialisation, Vérification API, Vérification HMAC Webhook
// ============================================================================

import crypto from 'crypto';

export type MomoOperator = 'mtn' | 'moov' | 'celtiis' | 'unknown';
export type FiatProvider = 'cinetpay' | 'kkiapay' | 'feexpay' | 'fedapay' | 'izichange' | 'sandbox';

export interface MomoPaymentRequest {
  amount: number;
  phone: string;
  operator?: MomoOperator;
  description?: string;
  patientEmail?: string;
  transactionId?: string;
  notifyUrl?: string;
  returnUrl?: string;
  metadata?: Record<string, any>;
}

export interface MomoPaymentResponse {
  transactionId: string;
  reference: string;
  amount: number;
  currency: 'XOF';
  operator: 'MTN_BENIN' | 'MOOV_BENIN' | 'CELTIIS_BENIN' | 'UNKNOWN';
  phone: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  provider: FiatProvider;
  isLive: boolean;
  paymentUrl?: string;
  message: string;
  createdAt: string;
  operatorHint?: MomoOperator;
}

export interface MomoVerifyResult {
  success: boolean;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'UNKNOWN';
  amount?: number;
  transactionId?: string;
  providerRef?: string;
}

class MobileMoneyService {
  private readonly MTN_PREFIXES = ['97', '96', '61', '62', '51', '52', '53', '54', '46'];
  private readonly MOOV_PREFIXES = ['95', '94', '66', '67', '55', '56', '57', '58', '47'];
  private readonly CELTIIS_PREFIXES = ['40', '41', '42', '43', '44', '45', '60', '63', '64', '65', '90', '91', '92', '93'];

  private inMemoryTransactions: Map<string, MomoPaymentResponse> = new Map();

  public get aggregatorChoice(): FiatProvider {
    const choice = (process.env.AGGREGATOR_CHOICE || process.env.FIAT_PROVIDER || 'sandbox').toLowerCase() as FiatProvider;
    const allowed: FiatProvider[] = ['cinetpay', 'kkiapay', 'feexpay', 'fedapay', 'izichange', 'sandbox'];
    return allowed.includes(choice) ? choice : 'sandbox';
  }

  public get celtiisSupported(): boolean {
    return process.env.CELTIIS_SUPPORT !== 'false';
  }

  // ==========================================================================
  // TÉLÉPHONE + OPERATEUR
  // ==========================================================================
  public normalizePhoneNumber(phone: string): { normalized: string; local: string; valid: boolean } {
    const cleaned = phone.replace(/[^0-9]/g, '');
    let local = cleaned;
    if (cleaned.startsWith('229') && cleaned.length >= 11) {
      local = cleaned.slice(3);
    } else if (cleaned.length === 8) {
      local = cleaned;
    }
    const valid = local.length === 8;
    const spaced = local.match(/.{1,2}/g)?.join(' ') ?? local;
    const normalized = `+229 ${spaced}`.trim();
    return { normalized, local, valid };
  }

  public detectOperator(phone: string): MomoOperator {
    const { local, valid } = this.normalizePhoneNumber(phone);
    if (!valid) return 'unknown';
    const prefix = local.slice(0, 2);
    if (this.MTN_PREFIXES.includes(prefix)) return 'mtn';
    if (this.MOOV_PREFIXES.includes(prefix)) return 'moov';
    if (this.celtiisSupported && this.CELTIIS_PREFIXES.includes(prefix)) return 'celtiis';
    return 'unknown';
  }

  private operatorLabel(op: MomoOperator): MomoPaymentResponse['operator'] {
    if (op === 'mtn') return 'MTN_BENIN';
    if (op === 'moov') return 'MOOV_BENIN';
    if (op === 'celtiis') return 'CELTIIS_BENIN';
    return 'UNKNOWN';
  }

  // ==========================================================================
  // WEBHOOK SECRET PAR PROVIDER
  // ==========================================================================
  private getWebhookSecret(provider: FiatProvider): string | undefined {
    switch (provider) {
      case 'cinetpay': return process.env.CINETPAY_WEBHOOK_SECRET;
      case 'kkiapay': return process.env.KKIAPAY_WEBHOOK_SECRET || process.env.KKIAPAY_PRIVATE_KEY;
      case 'feexpay': return process.env.FEEXPAY_WEBHOOK_SECRET;
      case 'fedapay': return process.env.FEDAPAY_WEBHOOK_SECRET;
      default: return undefined;
    }
  }

  public verifyWebhookSignature(provider: FiatProvider, rawBody: Buffer | string, signatureHeader: string | undefined): boolean {
    const secret = this.getWebhookSecret(provider);
    if (!secret) {
      return process.env.NODE_ENV !== 'production';
    }
    if (!signatureHeader) return false;
    const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const provided = String(signatureHeader).replace(/^sha256=/, '');
    if (provided.length !== expected.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // INITIALISATION PAIEMENT PAR AGRÉGATEUR
  // ==========================================================================
  public async initializePayment(request: MomoPaymentRequest): Promise<MomoPaymentResponse> {
    const { amount, phone, description, patientEmail, metadata } = request;
    const { normalized, local, valid } = this.normalizePhoneNumber(phone);
    if (!valid || amount <= 0) {
      throw new Error('Numéro de téléphone béninois (8 chiffres) ou montant invalide.');
    }
    let operator = request.operator || this.detectOperator(phone);
    if (operator === 'unknown') operator = 'mtn';

    const txId = request.transactionId || `MOMO-BJ-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const provider = this.aggregatorChoice;
    const publicBase = (process.env.PUBLIC_WEBHOOK_BASE_URL || '').replace(/\/$/, '');
    const notifyUrl = request.notifyUrl || (publicBase ? `${publicBase}/api/webhooks/mobile-money` : '');
    const returnUrl = request.returnUrl || (publicBase ? `${publicBase}/payment/return` : '');

    // =============== CINETPAY ===============
    if (provider === 'cinetpay') {
      const apiKey = process.env.CINETPAY_API_KEY;
      const siteId = process.env.CINETPAY_SITE_ID;
      const baseUrl = (process.env.CINETPAY_BASE_URL || 'https://api-checkout.cinetpay.com/v2/payment').replace(/\/$/, '');
      if (process.env.NODE_ENV === 'production' && (!apiKey?.trim() || !siteId?.trim())) {
        throw new Error('CINETPAY_API_KEY et CINETPAY_SITE_ID requis en production');
      }
      if (apiKey && siteId) {
        try {
          const resp = await fetch(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apikey: apiKey,
              site_id: Number(siteId) || siteId,
              transaction_id: txId,
              amount,
              currency: 'XOF',
              alternative_currency: 'XOF',
              description: description || 'Paiement Santé+ Bénin',
              customer: `+229${local}`,
              customer_name: `Patient Santé+`,
              customer_surname: `+229${local}`,
              customer_email: patientEmail || 'patient@santeplus.bj',
              customer_phone_number: `+229${local}`,
              notify_url: notifyUrl,
              return_url: returnUrl,
              metadata: JSON.stringify({ ...metadata, txId, operator }),
              lang: 'FR',
              channels: 'ALL',
            }),
          });
          if (resp.ok) {
            const data: any = await resp.json();
            if (data?.code === '201' || data?.payment_url) {
              const result: MomoPaymentResponse = {
                transactionId: txId,
                reference: String(data.cpm_trans_id || data.data?.cpm_trans_id || txId),
                amount,
                currency: 'XOF',
                operator: this.operatorLabel(operator),
                phone: normalized,
                status: 'PENDING',
                provider: 'cinetpay',
                isLive: true,
                paymentUrl: data.payment_url || data.data?.payment_url,
                message: `Demande envoyée via CinetPay. Validez sur votre téléphone ${normalized}`,
                createdAt: new Date().toISOString(),
                operatorHint: operator,
              };
              this.inMemoryTransactions.set(txId, result);
              return result;
            }
          } else {
            const txt = await resp.text().catch(() => '');
            console.warn('[CinetPay] Init échec HTTP', resp.status, txt.slice(0, 200));
          }
        } catch (err: any) {
          console.warn('[CinetPay] Erreur réseau', err.message);
          if (process.env.NODE_ENV === 'production') throw new Error('CinetPay indisponible');
        }
        if (process.env.NODE_ENV === 'production') throw new Error('CinetPay a refusé la demande');
      }
    }

    // =============== KKIAAPAY ===============
    if (provider === 'kkiapay') {
      const key = process.env.KKIAPAY_PRIVATE_KEY;
      if (process.env.NODE_ENV === 'production' && !key?.trim()) {
        throw new Error('KKIAPAY_PRIVATE_KEY requis en production');
      }
      if (key) {
        try {
          const resp = await fetch('https://api.kkiapay.me/v1/transactions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${key}`,
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              amount,
              reason: description || 'Paiement Santé+ Bénin',
              phone: `+229${local}`,
              callback_url: notifyUrl,
              redirect_url: returnUrl,
              transaction_id: txId,
              metadata: { ...metadata, txId, operator, source: 'santeplus-benin' },
            }),
          });
          if (resp.ok) {
            const data: any = await resp.json();
            const result: MomoPaymentResponse = {
              transactionId: txId,
              reference: String(data.transaction_id || data.id || txId),
              amount,
              currency: 'XOF',
              operator: this.operatorLabel(operator),
              phone: normalized,
              status: 'PENDING',
              provider: 'kkiapay',
              isLive: true,
              paymentUrl: data.payment_url || data.url,
              message: `Demande envoyée via Kkiapay. Validez sur votre téléphone ${normalized}`,
              createdAt: new Date().toISOString(),
              operatorHint: operator,
            };
            this.inMemoryTransactions.set(txId, result);
            return result;
          }
        } catch (err: any) {
          console.warn('[Kkiapay] Erreur', err.message);
          if (process.env.NODE_ENV === 'production') throw new Error('Kkiapay indisponible');
        }
        if (process.env.NODE_ENV === 'production') throw new Error('Kkiapay a refusé la demande');
      }
    }

    // =============== FEEXPAY ===============
    if (provider === 'feexpay') {
      const apiKey = process.env.FEEXPAY_API_KEY;
      const baseUrl = (process.env.FEEXPAY_BASE_URL || 'https://api.feexpay.com/api/v1/payment').replace(/\/$/, '');
      if (process.env.NODE_ENV === 'production' && !apiKey?.trim()) {
        throw new Error('FEEXPAY_API_KEY requis en production');
      }
      if (apiKey) {
        try {
          const resp = await fetch(baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Api-Key': apiKey,
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              amount,
              currency: 'XOF',
              description: description || 'Paiement Santé+ Bénin',
              phone: `+229${local}`,
              customer_email: patientEmail || 'patient@santeplus.bj',
              transaction_id: txId,
              notify_url: notifyUrl,
              return_url: returnUrl,
              operator: operator === 'celtiis' ? 'CELTIIS' : operator.toUpperCase(),
              country: 'BJ',
            }),
          });
          if (resp.ok) {
            const data: any = await resp.json();
            const result: MomoPaymentResponse = {
              transactionId: txId,
              reference: String(data.transaction_id || data.reference || txId),
              amount,
              currency: 'XOF',
              operator: this.operatorLabel(operator),
              phone: normalized,
              status: 'PENDING',
              provider: 'feexpay',
              isLive: true,
              paymentUrl: data.payment_url || data.checkout_url,
              message: `Demande envoyée via FeexPay. Validez sur votre téléphone ${normalized}`,
              createdAt: new Date().toISOString(),
              operatorHint: operator,
            };
            this.inMemoryTransactions.set(txId, result);
            return result;
          }
        } catch (err: any) {
          console.warn('[FeexPay] Erreur', err.message);
          if (process.env.NODE_ENV === 'production') throw new Error('FeexPay indisponible');
        }
        if (process.env.NODE_ENV === 'production') throw new Error('FeexPay a refusé la demande');
      }
    }

    // =============== FEDAPAY (fallback) ===============
    if (provider === 'fedapay') {
      const providerKey = process.env.FEDAPAY_SECRET_KEY;
      const providerUrl = process.env.FIAT_API_URL || 'https://api.fedapay.com/v1/transactions';
      if (process.env.NODE_ENV === 'production' && (!providerKey?.trim() || !providerUrl)) {
        throw new Error('FEDAPAY_SECRET_KEY requis en production');
      }
      if (providerKey && providerUrl) {
        try {
          const resp = await fetch(providerUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${providerKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              description: description || 'Paiement Santé+ Bénin',
              amount,
              currency: { iso: 'XOF' },
              callback_url: notifyUrl,
              customer: {
                phone_number: { number: local, country: 'bj' },
                email: patientEmail || 'patient@santeplus.bj',
              },
            }),
          });
          if (resp.ok) {
            const data: any = await resp.json();
            const tx = data['v1/transaction'] || data;
            const result: MomoPaymentResponse = {
              transactionId: txId,
              reference: String(tx.id || tx.reference || txId),
              amount,
              currency: 'XOF',
              operator: this.operatorLabel(operator),
              phone: normalized,
              status: 'PENDING',
              provider: 'fedapay',
              isLive: true,
              paymentUrl: tx.url,
              message: `Demande envoyée via FedaPay. Validez sur votre téléphone ${normalized}`,
              createdAt: new Date().toISOString(),
              operatorHint: operator,
            };
            this.inMemoryTransactions.set(txId, result);
            return result;
          }
        } catch (err: any) {
          console.warn('[FedaPay] Erreur', err.message);
          if (process.env.NODE_ENV === 'production') throw new Error('FedaPay indisponible');
        }
        if (process.env.NODE_ENV === 'production') throw new Error('FedaPay a refusé la demande');
      }
    }

    // =============== SANDBOX ===============
    const result: MomoPaymentResponse = {
      transactionId: txId,
      reference: `REF-BJ-${Math.floor(100000 + Math.random() * 900000)}`,
      amount,
      currency: 'XOF',
      operator: this.operatorLabel(operator),
      phone: normalized,
      status: 'PENDING',
      provider: 'sandbox',
      isLive: false,
      message: `[Sandbox] Demande Mobile Money initiée. Paiement simulé.`,
      createdAt: new Date().toISOString(),
      operatorHint: operator,
    };
    this.inMemoryTransactions.set(txId, result);
    return result;
  }

  // ==========================================================================
  // VÉRIFICATION STATUT VIA API (double-check après webhook)
  // ==========================================================================
  public async verifyPaymentStatus(provider: FiatProvider, providerRef: string, txId?: string): Promise<MomoVerifyResult> {
    // ---- CINETPAY ----
    if (provider === 'cinetpay') {
      const apiKey = process.env.CINETPAY_API_KEY;
      const siteId = process.env.CINETPAY_SITE_ID;
      if (apiKey && siteId && providerRef) {
        try {
          const resp = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apikey: apiKey,
              site_id: Number(siteId) || siteId,
              transaction_id: txId || providerRef,
              cpm_trans_id: providerRef,
            }),
          });
          if (resp.ok) {
            const data: any = await resp.json();
            const code = String(data?.code || data?.data?.code || '');
            const status = String(data?.status || data?.data?.status || '').toUpperCase();
            const amount = Number(data?.amount || data?.data?.amount);
            if (code === '00' || status === 'ACCEPTED' || status === 'SUCCESS') {
              return { success: true, status: 'SUCCESS', amount, providerRef };
            }
            if (code === '02' || status === 'REFUSED' || status === 'FAILED') {
              return { success: false, status: 'FAILED', amount, providerRef };
            }
            return { success: false, status: 'PENDING', amount, providerRef };
          }
        } catch (err: any) {
          console.warn('[CinetPay] Verify échec', err.message);
        }
      }
    }

    // ---- KKIAAPAY ----
    if (provider === 'kkiapay') {
      const key = process.env.KKIAPAY_PRIVATE_KEY;
      if (key && providerRef) {
        try {
          const resp = await fetch(`https://api.kkiapay.me/v1/transactions/${encodeURIComponent(providerRef)}`, {
            headers: { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' },
          });
          if (resp.ok) {
            const data: any = await resp.json();
            const s = String(data?.status || '').toUpperCase();
            const amount = Number(data?.amount);
            if (s === 'SUCCESS' || s === 'COMPLETED' || s === 'PAID') return { success: true, status: 'SUCCESS', amount, providerRef };
            if (s === 'FAILED' || s === 'CANCELLED' || s === 'REJECTED') return { success: false, status: 'FAILED', amount, providerRef };
            return { success: false, status: 'PENDING', amount, providerRef };
          }
        } catch (err: any) { console.warn('[Kkiapay] Verify échec', err.message); }
      }
    }

    // ---- FEEXPAY ----
    if (provider === 'feexpay') {
      const apiKey = process.env.FEEXPAY_API_KEY;
      const baseUrl = (process.env.FEEXPAY_BASE_URL || 'https://api.feexpay.com/api/v1/payment').replace(/\/$/, '');
      if (apiKey && providerRef) {
        try {
          const resp = await fetch(`${baseUrl}/${encodeURIComponent(providerRef)}`, {
            headers: { 'X-Api-Key': apiKey, 'Authorization': `Bearer ${apiKey}` },
          });
          if (resp.ok) {
            const data: any = await resp.json();
            const s = String(data?.status || '').toUpperCase();
            const amount = Number(data?.amount);
            if (s === 'SUCCESS' || s === 'COMPLETED' || s === 'PAID') return { success: true, status: 'SUCCESS', amount, providerRef };
            if (s === 'FAILED' || s === 'CANCELLED') return { success: false, status: 'FAILED', amount, providerRef };
            return { success: false, status: 'PENDING', amount, providerRef };
          }
        } catch (err: any) { console.warn('[FeexPay] Verify échec', err.message); }
      }
    }

    // ---- FEDAPAY ----
    if (provider === 'fedapay') {
      const key = process.env.FEDAPAY_SECRET_KEY;
      const base = (process.env.FIAT_API_URL || 'https://api.fedapay.com/v1/transactions').replace(/\/$/, '');
      if (key && providerRef) {
        try {
          const resp = await fetch(`${base}/${encodeURIComponent(providerRef)}`, {
            headers: { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' },
          });
          if (resp.ok) {
            const data: any = await resp.json();
            const tx = data['v1/transaction'] || data;
            const s = String(tx?.status || '').toLowerCase();
            const amount = Number(tx?.amount);
            if (s === 'approved' || s === 'completed' || s === 'paid') return { success: true, status: 'SUCCESS', amount, providerRef };
            if (s === 'failed' || s === 'refused' || s === 'canceled') return { success: false, status: 'FAILED', amount, providerRef };
            return { success: false, status: 'PENDING', amount, providerRef };
          }
        } catch (err: any) { console.warn('[FedaPay] Verify échec', err.message); }
      }
    }

    return { success: false, status: 'UNKNOWN', providerRef };
  }

  // ==========================================================================
  // HELPERS RÉTROCOMPATIBLES
  // ==========================================================================
  public getTransactionStatus(transactionId: string): MomoPaymentResponse | null {
    return this.inMemoryTransactions.get(transactionId) || null;
  }

  public processWebhook(payload: any): { success: boolean; transactionId?: string } {
    const txId = payload?.transaction_id || payload?.transactionId || payload?.cpm_custom || payload?.id || payload?.reference;
    if (txId && this.inMemoryTransactions.has(String(txId))) {
      const tx = this.inMemoryTransactions.get(String(txId))!;
      tx.status = 'SUCCESS';
      return { success: true, transactionId: String(txId) };
    }
    return { success: false };
  }
}

export const momoService = new MobileMoneyService();
export default momoService;
