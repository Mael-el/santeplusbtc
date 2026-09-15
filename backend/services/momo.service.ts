// ============================================================================
// SERVICE PAIEMENT MOBILE MONEY BÉNIN (MTN MoMo & Moov Flooz / FedaPay)
// Gestion unifiée des paiements en Francs CFA (XOF) pour le Bénin
// ============================================================================

import crypto from 'crypto';

export type MomoOperator = 'mtn' | 'moov' | 'unknown';
export type FiatProvider = 'fedapay' | 'izichange' | 'kkiapay' | 'sandbox';

export interface MomoPaymentRequest {
  amount: number; // Montant en FCFA
  phone: string;  // Numéro de téléphone (+229...)
  operator?: MomoOperator;
  description?: string;
  patientEmail?: string;
}

export interface MomoPaymentResponse {
  transactionId: string;
  reference: string;
  amount: number;
  currency: 'XOF';
  operator: 'MTN_BENIN' | 'MOOV_BENIN';
  phone: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  provider: FiatProvider;
  isLive: boolean;
  paymentUrl?: string;
  message: string;
  createdAt: string;
}

class MobileMoneyService {
  // Préfixes des opérateurs mobiles au Bénin
  private readonly MTN_PREFIXES = ['97', '96', '61', '62', '51', '52', '53', '54', '46'];
  private readonly MOOV_PREFIXES = ['95', '94', '66', '67', '55', '56', '57', '58', '47'];

  private inMemoryTransactions: Map<string, MomoPaymentResponse> = new Map();

  /**
   * Normalise un numéro de téléphone béninois (+229 ...)
   */
  public normalizePhoneNumber(phone: string): { normalized: string; local: string; valid: boolean } {
    const cleaned = phone.replace(/[^0-9]/g, '');
    let local = cleaned;

    if (cleaned.startsWith('229') && cleaned.length >= 13) {
      local = cleaned.slice(3);
    } else if (cleaned.length === 8) {
      local = cleaned;
    }

    const valid = local.length === 8;
    const normalized = `+229 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)} ${local.slice(8, 10)}`;

    return { normalized, local, valid };
  }

  /**
   * Détecte automatiquement l'opérateur béninois à partir du préfixe
   */
  public detectOperator(phone: string): MomoOperator {
    const { local, valid } = this.normalizePhoneNumber(phone);
    if (!valid) return 'unknown';

    const prefix = local.slice(0, 2);
    if (this.MTN_PREFIXES.includes(prefix)) return 'mtn';
    if (this.MOOV_PREFIXES.includes(prefix)) return 'moov';

    return 'unknown';
  }

  /**
   * Initialise un paiement Mobile Money (FedaPay, Izichange ou Sandbox fluide)
   */
  public async initializePayment(request: MomoPaymentRequest): Promise<MomoPaymentResponse> {
    const { amount, phone, description, patientEmail } = request;
    const { normalized, local, valid } = this.normalizePhoneNumber(phone);

    if (!valid || amount <= 0) {
      throw new Error('Numéro de téléphone béninois (10 chiffres) ou montant invalide.');
    }

    let operator = request.operator || this.detectOperator(phone);
    if (operator === 'unknown') {
      operator = 'mtn'; // Défaut
    }

    const opLabel = operator === 'mtn' ? 'MTN_BENIN' : 'MOOV_BENIN';
    const txId = `MOMO-BJ-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const provider = (process.env.FIAT_PROVIDER || 'fedapay').toLowerCase() as FiatProvider;
    const providerKey = provider === 'fedapay'
      ? process.env.FEDAPAY_SECRET_KEY
      : provider === 'kkiapay'
        ? process.env.KKIAPAY_PRIVATE_KEY
        : process.env.IZICHANGE_API_KEY;
    const providerUrl = provider === 'fedapay'
      ? 'https://api.fedapay.com/v1/transactions'
      : process.env.FIAT_API_URL;

    if (process.env.NODE_ENV === 'production' && (!providerKey?.trim() || !providerUrl)) {
      throw new Error(`${provider.toUpperCase()} payment credentials and FIAT_API_URL must be configured in production`);
    }

    // 1. API fournisseur configurée. Les formats exacts peuvent être adaptés via FIAT_API_URL.
    if (providerKey && providerUrl) {
      try {
        const response = await fetch(providerUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${providerKey}`,
            'X-Api-Key': providerKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: description || 'Recharge Santé+ Bénin',
            amount,
            currency: { iso: 'XOF' },
            customer: {
              phone_number: { number: local, country: 'bj' },
              email: patientEmail || 'citoyen@sante.bj',
            },
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          const tx = data['v1/transaction'] || data;
          const result: MomoPaymentResponse = {
            transactionId: txId,
            reference: String(tx.id || tx.reference || txId),
            amount,
            currency: 'XOF',
            operator: opLabel,
            phone: normalized,
            status: 'PENDING',
            provider,
            isLive: true,
            paymentUrl: tx.url,
            message: `Demande de validation envoyée sur le mobile ${normalized}`,
            createdAt: new Date().toISOString(),
          };
          this.inMemoryTransactions.set(txId, result);
          return result;
        }
      } catch (err: any) {
        console.warn(`[${provider} API] Erreur réseau:`, err.message);
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`${provider} is unavailable in production`);
        }
      }

      if (process.env.NODE_ENV === 'production') {
        throw new Error(`${provider} rejected the payment request`);
      }
    }

    // 2. Mode Sandbox Résilient (Démonstration fluide 100% stable)
    const result: MomoPaymentResponse = {
      transactionId: txId,
      reference: `REF-BJ-${Math.floor(100000 + Math.random() * 900000)}`,
      amount,
      currency: 'XOF',
      operator: opLabel,
      phone: normalized,
      status: 'SUCCESS',
      provider: 'sandbox',
      isLive: false,
      message: `Paiement ${opLabel.replace('_', ' ')} de ${amount.toLocaleString()} FCFA validé avec succès`,
      createdAt: new Date().toISOString(),
    };

    this.inMemoryTransactions.set(txId, result);
    return result;
  }

  /**
   * Vérifie le statut d'une transaction Mobile Money
   */
  public getTransactionStatus(transactionId: string): MomoPaymentResponse | null {
    return this.inMemoryTransactions.get(transactionId) || null;
  }

  /**
   * Reçoit un webhook entrant de confirmation Mobile Money
   */
  public processWebhook(payload: any): { success: boolean; transactionId?: string } {
    const txId = payload?.transactionId || payload?.id;
    if (txId && this.inMemoryTransactions.has(txId)) {
      const tx = this.inMemoryTransactions.get(txId)!;
      tx.status = 'SUCCESS';
      return { success: true, transactionId: txId };
    }
    return { success: false };
  }
}

export const momoService = new MobileMoneyService();
export default momoService;
