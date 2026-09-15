// ============================================================================
// SERVICE LIGHTNING NETWORK (LNbits + Conversion XOF↔sats + Webhook HMAC)
// ============================================================================

import crypto from 'crypto';

export interface LightningInvoiceResult {
  invoice: string;
  paymentHash: string;
  invoiceId: string;
  amountSats: number;
  amountXOF: number;
  expiresAt: number;
  isLive: boolean;
  provider: 'lnbits' | 'breez' | 'izichange' | 'sandbox';
  rateApplied?: number;
}

export interface LightningPaymentStatus {
  paid: boolean;
  preimage?: string;
  amountSats?: number;
  provider: 'lnbits' | 'breez' | 'izichange' | 'sandbox';
}

export interface XofSatsRate {
  rate: number;
  source: 'coingecko' | 'coinbase' | 'fallback';
  fetchedAt: number;
}

class LightningService {
  private cachedRate: XofSatsRate | null = null;

  private get lnbitsUrl(): string {
    return (process.env.LNBITS_URL || 'http://localhost:5000').replace(/\/$/, '');
  }

  private get lnbitsApiKey(): string | undefined {
    return process.env.LNBITS_API_KEY;
  }

  private get webhookSecret(): string | undefined {
    return process.env.LNBITS_WEBHOOK_SECRET || process.env.LNBITS_API_KEY;
  }

  private get provider(): 'lnbits' | 'breez' | 'izichange' | 'sandbox' {
    const value = (process.env.LIGHTNING_PROVIDER || 'lnbits').toLowerCase();
    return value === 'breez' || value === 'izichange' || value === 'lnbits' ? value : 'sandbox';
  }

  private get apiUrl(): string {
    return (process.env.LIGHTNING_API_URL || '').replace(/\/$/, '');
  }

  private get apiKey(): string | undefined {
    return process.env.LIGHTNING_API_KEY || this.lnbitsApiKey;
  }

  public isConfigured(): boolean {
    if (this.provider === 'lnbits') return Boolean(this.lnbitsApiKey?.trim());
    return Boolean(this.apiUrl && this.apiKey?.trim());
  }

  // ==========================================================================
  // CONVERSION XOF → SATS (avec cache 5 min + fallback)
  // ==========================================================================
  public async getXofToSatsRate(): Promise<XofSatsRate> {
    const now = Date.now();
    if (this.cachedRate && now - this.cachedRate.fetchedAt < 5 * 60 * 1000) {
      return this.cachedRate;
    }

    const fallbackRate = 1.666;
    const fallbackResult: XofSatsRate = { rate: fallbackRate, source: 'fallback', fetchedAt: now };

    if (process.env.NODE_ENV === 'test') {
      this.cachedRate = fallbackResult;
      return fallbackResult;
    }

    // 1. CoinGecko : BTC vs XOF
    try {
      const resp = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=xof',
        { method: 'GET', headers: { 'Accept': 'application/json' } }
      );
      if (resp.ok) {
        const data: any = await resp.json();
        const btcXof = Number(data?.bitcoin?.xof);
        if (btcXof > 0) {
          const rate = 1e8 / btcXof; // 1 BTC = 1e8 sats → sats/XOF = 1e8 / BTCperXOF
          const result: XofSatsRate = { rate, source: 'coingecko', fetchedAt: now };
          this.cachedRate = result;
          return result;
        }
      }
    } catch (err) { /* next */ }

    // 2. Coinbase : BTC/USD + XOF/USD via spot
    try {
      const resp = await fetch(
        'https://api.coinbase.com/v2/prices/BTC-XOF/spot',
        { method: 'GET', headers: { 'Accept': 'application/json' } }
      );
      if (resp.ok) {
        const data: any = await resp.json();
        const btcXof = Number(data?.data?.amount);
        if (btcXof > 0) {
          const rate = 1e8 / btcXof;
          const result: XofSatsRate = { rate, source: 'coinbase', fetchedAt: now };
          this.cachedRate = result;
          return result;
        }
      }
    } catch (err) { /* next */ }

    this.cachedRate = fallbackResult;
    return fallbackResult;
  }

  public xofToSats(amountXof: number, rate: number): number {
    if (!Number.isFinite(amountXof) || amountXof <= 0) return 0;
    return Math.max(1, Math.round(amountXof * rate));
  }

  public async createInvoiceWithConversion(
    amountXof: number,
    description: string = 'Facture Santé+ Bénin'
  ): Promise<LightningInvoiceResult> {
    if (amountXof <= 0) throw new Error('Montant invalide');
    const rateInfo = await this.getXofToSatsRate();
    const amountSats = this.xofToSats(amountXof, rateInfo.rate);
    const inv = await this.createInvoice(amountSats, amountXof, description);
    return { ...inv, rateApplied: rateInfo.rate };
  }

  // ==========================================================================
  // CRÉATION INVOICE (LNbits / Breez / Izichange / Sandbox)
  // ==========================================================================
  public async createInvoice(
    amountSats: number,
    amountXOF: number,
    description: string = 'Facture Santé+ Bénin'
  ): Promise<LightningInvoiceResult> {
    const invoiceId = `LN-INV-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    if (process.env.NODE_ENV === 'production' && !this.isConfigured()) {
      throw new Error(`${this.provider.toUpperCase()} Lightning credentials must be configured in production`);
    }

    if (this.provider === 'lnbits' && this.isConfigured()) {
      try {
        const response = await fetch(`${this.lnbitsUrl}/api/v1/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.lnbitsApiKey!,
          },
          body: JSON.stringify({
            out: false,
            amount: amountSats,
            memo: `${description} [${invoiceId}]`,
            extra: {
              tag: 'santeplus-benin',
              invoiceId,
              amountXOF,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return {
            invoice: data.payment_request,
            paymentHash: data.payment_hash,
            invoiceId,
            amountSats,
            amountXOF,
            expiresAt: Date.now() + 3600 * 1000,
            isLive: true,
            provider: 'lnbits',
          };
        } else {
          console.warn(`LNbits API returned ${response.status}. Bascule en mode sandbox résilient.`);
        }
      } catch (err) {
        console.warn('Erreur de connexion à LNbits:', err);
        if (process.env.NODE_ENV === 'production') {
          throw new Error('LNbits is unavailable in production');
        }
      }

      if (process.env.NODE_ENV === 'production') {
        throw new Error('LNbits rejected the invoice request');
      }
    }

    if ((this.provider === 'breez' || this.provider === 'izichange') && this.isConfigured()) {
      try {
        const response = await fetch(`${this.apiUrl}/invoices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'X-Api-Key': this.apiKey!,
          },
          body: JSON.stringify({ amountSats, amount_sats: amountSats, amountXOF, currency: 'XOF', description, invoiceId }),
        });
        const data: any = await response.json().catch(() => ({}));
        const invoice = data.invoice || data.payment_request || data.paymentRequest || data.bolt11;
        const paymentHash = data.payment_hash || data.paymentHash || data.hash;
        if (response.ok && invoice && paymentHash) {
          return { invoice, paymentHash, invoiceId, amountSats, amountXOF, expiresAt: Date.now() + 3600 * 1000, isLive: true, provider: this.provider };
        }
        throw new Error(`Provider response ${response.status} missing invoice fields`);
      } catch (err: any) {
        if (process.env.NODE_ENV === 'production') throw new Error(`${this.provider} Lightning unavailable: ${err.message}`);
      }
    }

    if (process.env.NODE_ENV === 'production') throw new Error('Lightning provider unavailable in production');
    const preimage = crypto.randomBytes(32);
    const paymentHash = crypto.createHash('sha256').update(preimage).digest('hex');
    const bolt11 = `lnbc${amountSats}u1p${Math.floor(Date.now()/1000).toString(36)}pp5${paymentHash.slice(0,52)}qdqg2fhk6mmpwq5kget8wf5k2cmzv9hkutssw3skget8v4cxjumn94sk2uewdqh8gmpwd3jxc6tvd3hxw3scqpvqyjw5qcqpxrzjqw72q3ksla762hsp48qaswep7mqcxw6mppv6mpwpwqf7mpws9p4xpwpvq5qshxztf9f8gskqfq9gqkcxsqypqxpqxzszqxpqw7p9`;

    return {
      invoice: bolt11,
      paymentHash,
      invoiceId,
      amountSats,
      amountXOF,
      expiresAt: Date.now() + 3600 * 1000,
      isLive: false,
      provider: 'sandbox',
    };
  }

  // ==========================================================================
  // VÉRIFICATION STATUT PAIEMENT
  // ==========================================================================
  public async checkPaymentStatus(paymentHash: string): Promise<LightningPaymentStatus> {
    if (this.provider === 'lnbits' && this.isConfigured()) {
      try {
        const response = await fetch(`${this.lnbitsUrl}/api/v1/payments/${paymentHash}`, {
          method: 'GET',
          headers: { 'X-Api-Key': this.lnbitsApiKey! },
        });
        if (response.ok) {
          const data = await response.json();
          return {
            paid: Boolean(data.paid),
            preimage: data.preimage,
            amountSats: data.details?.amount ? Math.round(data.details.amount / 1000) : undefined,
            provider: 'lnbits',
          };
        }
      } catch (err) {
        console.warn('Erreur vérification LNbits:', err);
      }
    }

    if ((this.provider === 'breez' || this.provider === 'izichange') && this.isConfigured()) {
      try {
        const response = await fetch(`${this.apiUrl}/invoices/${paymentHash}`, {
          headers: { 'Authorization': `Bearer ${this.apiKey}`, 'X-Api-Key': this.apiKey! },
        });
        const data: any = await response.json().catch(() => ({}));
        if (response.ok) return {
          paid: Boolean(data.paid ?? data.settled ?? data.status === 'paid'),
          preimage: data.preimage,
          amountSats: data.amountSats || data.amount_sats,
          provider: this.provider,
        };
      } catch (err) {
        console.warn(`Erreur vérification ${this.provider}:`, err);
      }
    }

    return { paid: false, provider: 'sandbox' };
  }

  // ==========================================================================
  // VÉRIFICATION SIGNATURE HMAC WEBHOOK LIGHTNING
  // ==========================================================================
  public verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string | undefined): boolean {
    const secret = this.webhookSecret;
    if (!secret) return process.env.NODE_ENV !== 'production';
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
}

export const lightningService = new LightningService();
export default lightningService;
