import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, CheckCircle2, XCircle, ArrowRight, Loader2, Phone, Zap,
  RefreshCw, Wallet as WalletIcon, ArrowLeft,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '../../services/api';
import type { PaymentMethod, Invoice } from '../../types';

type Step = 'method' | 'confirm' | 'processing' | 'success' | 'failure';

interface InvoicePaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  currentBalanceXof?: number;
  patientPhone?: string;
  onPaid?: (updatedInvoice?: Invoice, newBalanceXof?: number) => void;
}

const METHOD_META: Record<PaymentMethod, {
  label: string;
  tagline: string;
  color: string;
  accent: string;
  abbr: string;
  needPhone: boolean;
}> = {
  wallet: {
    label: 'Mon Wallet Santé+',
    tagline: 'Solde disponible — débit immédiat',
    color: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    accent: 'bg-emerald-600',
    abbr: 'W',
    needPhone: false,
  },
  mtn: {
    label: 'MTN Mobile Money',
    tagline: 'Paiement via MTN MoMo Bénin',
    color: 'bg-yellow-50 text-yellow-900 border-yellow-200',
    accent: 'bg-yellow-500',
    abbr: 'MTN',
    needPhone: true,
  },
  moov: {
    label: 'Moov Money',
    tagline: 'Paiement via Moov Bénin',
    color: 'bg-blue-50 text-blue-900 border-blue-200',
    accent: 'bg-blue-600',
    abbr: 'Moov',
    needPhone: true,
  },
  celtiis: {
    label: 'Celtiis Cash',
    tagline: 'Paiement via Celtiis Bénin',
    color: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    accent: 'bg-teal-600',
    abbr: 'Celtiis',
    needPhone: true,
  },
  lightning: {
    label: 'Lightning Network',
    tagline: 'Paiement Bitcoin instantané',
    color: 'bg-orange-50 text-orange-900 border-orange-200',
    accent: 'bg-orange-500',
    abbr: '₿',
    needPhone: false,
  },
};

export default function InvoicePaymentModal({
  open,
  onClose,
  invoice,
  currentBalanceXof = 0,
  patientPhone,
  onPaid,
}: InvoicePaymentModalProps) {
  const [step, setStep] = useState<Step>('method');
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [phone, setPhone] = useState<string>(patientPhone || '');
  const [error, setError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollRef = useRef<number | null>(null);

  const totalXof = invoice?.totalXOF ?? 0;
  const canUseWallet = totalXof > 0 && currentBalanceXof >= totalXof;

  const resetState = () => {
    setStep('method');
    setMethod(null);
    setError(null);
    setPaymentResult(null);
    setNewBalance(null);
    setIsSubmitting(false);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) {
      resetState();
    } else if (patientPhone) {
      setPhone(patientPhone);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
     
  }, [open, invoice?.id]);

  const close = () => {
    resetState();
    onClose();
  };

  const goToConfirm = () => {
    if (!method) return;
    setError(null);
    if (method === 'wallet' && !canUseWallet) {
      setError(
        `Solde insuffisant. Il vous manque ${(
          totalXof - currentBalanceXof
        ).toLocaleString('fr-FR')} FCFA pour payer avec le wallet.`
      );
      return;
    }
    setStep('confirm');
  };

  const canSubmit =
    !!method &&
    (METHOD_META[method].needPhone ? phone.replace(/[^\d]/g, '').length >= 8 : true) &&
    (method !== 'wallet' || canUseWallet);

  const handleSubmit = async () => {
    if (!canSubmit || !method || !invoice?.id || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    setStep('processing');
    try {
      const resp = await apiClient.payInvoiceV3(
        invoice.id,
        method,
        method === 'lightning' ? 'lnbits' : method === 'wallet' ? 'wallet' : method,
        method === 'wallet' ? undefined : phone
      );
      setPaymentResult(resp);

      if (method === 'wallet' && resp?.status === 'PAID') {
        finishSuccess(resp);
        return;
      }
      if (method === 'lightning') {
        startLightningPolling(resp);
      } else if (resp?.paymentUrl) {
        window.open(resp.paymentUrl, '_blank', 'noopener,noreferrer');
        startStatusPolling();
      } else {
        startStatusPolling();
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          'Erreur lors du paiement de la facture.'
      );
      setStep('failure');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startLightningPolling = (r: any) => {
    if (!invoice?.id) return;
    if (pollRef.current) clearInterval(pollRef.current);
    let ticks = 0;
    const MAX_TICKS = 450;
    pollRef.current = window.setInterval(async () => {
      try {
        ticks++;
        const status = await apiClient.getInvoiceStatus(invoice.id);
        if (status?.paid || status?.lightningPaid || status?.status === 'PAID') {
          const full = await apiClient.getInvoiceV3(invoice.id);
          finishSuccess(full || status);
          return;
        }
        if (ticks >= MAX_TICKS) {
          setError(
            'Temps de paiement dépassé. Veuillez réessayer ou utiliser un autre moyen.'
          );
          setStep('failure');
        }
      } catch {
        /* ignore */
      }
    }, 2500);
  };

  const startStatusPolling = () => {
    if (!invoice?.id) return;
    if (pollRef.current) clearInterval(pollRef.current);
    let ticks = 0;
    const MAX_TICKS = 120;
    pollRef.current = window.setInterval(async () => {
      try {
        ticks++;
        const status = await apiClient.getInvoiceStatus(invoice.id);
        if (status?.paid || status?.status === 'PAID') {
          const full = await apiClient.getInvoiceV3(invoice.id);
          finishSuccess(full || status);
          return;
        }
        if (ticks >= MAX_TICKS) {
          setError(
            'Paiement en attente de validation par l\'agrégateur. Si vous avez validé sur votre téléphone, réessayez plus tard.'
          );
          setStep('failure');
        }
      } catch {
        /* ignore */
      }
    }, 2500);
  };

  const finishSuccess = async (result: any) => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    try {
      const bal = await apiClient.getWalletBalance();
      setNewBalance(bal.balanceXof);
      onPaid?.(result, bal.balanceXof);
    } catch {
      const nb =
        method === 'wallet' ? Math.max(0, currentBalanceXof - totalXof) : currentBalanceXof;
      setNewBalance(nb);
      onPaid?.(result, nb);
    }
    setStep('success');
  };

  if (!open || !invoice) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg bg-white rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white z-10 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-slate-100 rounded-t-3xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Payer la facture
                </h2>
                <p className="mt-1 text-xs sm:text-sm font-bold text-slate-500 truncate">
                  {invoice.hospitalName} · {invoice.patientName}
                </p>
                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 border border-emerald-200">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-700">
                    Total : {totalXof.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              </div>
              <button
                onClick={close}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            <AnimatePresence mode="wait">
              {/* STEP 1: CHOIX MÉTHODE */}
              {step === 'method' && (
                <motion.div
                  key="method"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  <label className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    Choisir le moyen de paiement
                  </label>
                  <div className="space-y-3">
                    {(Object.keys(METHOD_META) as PaymentMethod[]).map((m) => {
                      const meta = METHOD_META[m];
                      const selected = method === m;
                      const disabledWallet = m === 'wallet' && !canUseWallet;
                      return (
                        <button
                          type="button"
                          key={m}
                          onClick={() => !disabledWallet && setMethod(m)}
                          disabled={disabledWallet}
                          className={`w-full min-h-[72px] sm:min-h-[80px] rounded-2xl border-2 p-3 sm:p-4 text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                            selected
                              ? `${meta.color} ring-2 ring-offset-1 ring-emerald-500 shadow-md scale-[1.005]`
                              : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                          } ${disabledWallet ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div
                              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl ${meta.accent} text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0`}
                            >
                              {m === 'wallet' ? (
                                <WalletIcon className="w-5 h-5" />
                              ) : m === 'lightning' ? (
                                <Zap className="w-5 h-5" />
                              ) : (
                                meta.abbr
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-black text-sm sm:text-base leading-tight truncate">
                                {meta.label}
                              </p>
                              <p className="text-[11px] font-bold opacity-70 mt-0.5 leading-tight truncate">
                                {m === 'wallet' && !canUseWallet
                                  ? `Solde insuffisant (${currentBalanceXof.toLocaleString('fr-FR')} FCFA dispo.)`
                                  : m === 'wallet'
                                  ? `Solde : ${currentBalanceXof.toLocaleString('fr-FR')} FCFA`
                                  : meta.tagline}
                              </p>
                            </div>
                          </div>
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              selected
                                ? 'bg-emerald-600 border-emerald-600'
                                : 'border-slate-300'
                            }`}
                          >
                            {selected && <CheckCircle2 className="w-4 h-4 text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {error && (
                    <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-xs font-bold text-red-800">
                      {error}
                    </div>
                  )}

                  {error && error.includes('Solde insuffisant') && (
                    <button
                      type="button"
                      onClick={close}
                      className="w-full min-h-[52px] rounded-2xl bg-white border-2 border-emerald-500 text-emerald-700 font-black hover:bg-emerald-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Recharger mon wallet d&apos;abord
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={goToConfirm}
                    disabled={!method || (method === 'wallet' && !canUseWallet)}
                    className="w-full min-h-[56px] rounded-2xl bg-[#00a86b] text-white font-black text-base sm:text-lg shadow-lg hover:bg-[#00905d] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Continuer
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </motion.div>
              )}

              {/* STEP 2: CONFIRMATION */}
              {step === 'confirm' && method && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-5"
                >
                  <div className="rounded-3xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 sm:p-5 space-y-3">
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-700">
                      Récapitulatif du paiement
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">Établissement</span>
                      <span className="text-sm font-black text-slate-900 text-right max-w-[55%] truncate">
                        {invoice.hospitalName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">Patient</span>
                      <span className="text-sm font-black text-slate-900">{invoice.patientName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">Date</span>
                      <span className="text-sm font-black text-slate-900">{invoice.date}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">Méthode</span>
                      <span className="text-sm font-black text-slate-900">
                        {METHOD_META[method].label}
                      </span>
                    </div>
                    <div className="h-px bg-emerald-200/70 my-1" />
                    <div className="flex items-center justify-between">
                      <span className="text-base font-black uppercase tracking-wider text-emerald-900">
                        Total à payer
                      </span>
                      <span className="text-2xl font-black text-emerald-900">
                        {totalXof.toLocaleString('fr-FR')}{' '}
                        <span className="text-sm font-bold">FCFA</span>
                      </span>
                    </div>
                  </div>

                  {METHOD_META[method].needPhone && (
                    <div className="space-y-2 rounded-2xl border-2 border-slate-200 focus-within:border-emerald-500 bg-white p-3 transition">
                      <label className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-700">
                        <Phone className="w-4 h-4 text-emerald-600" />
                        Numéro {METHOD_META[method].abbr}
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+229 97 00 00 00"
                        className="w-full min-h-[48px] px-2 text-lg font-black text-slate-900 bg-transparent outline-none"
                      />
                      <p className="text-[11px] font-bold text-slate-500">
                        Un SMS de validation sera envoyé sur ce numéro.
                      </p>
                    </div>
                  )}

                  {method === 'wallet' && (
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-900">
                      <strong className="font-black">✓ Solde suffisant</strong> — Débit de{' '}
                      <strong>{totalXof.toLocaleString('fr-FR')} FCFA</strong> immédiat après
                      confirmation. Nouveau solde :{' '}
                      <strong>
                        {(currentBalanceXof - totalXof).toLocaleString('fr-FR')} FCFA
                      </strong>
                      .
                    </div>
                  )}

                  {error && (
                    <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-xs font-bold text-red-800">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-2 sm:gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('method');
                        setError(null);
                      }}
                      className="flex-1 min-h-[56px] rounded-2xl bg-white border-2 border-slate-200 text-slate-800 font-black hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Retour
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!canSubmit || isSubmitting}
                      className="flex-[2] min-h-[56px] rounded-2xl bg-[#00a86b] text-white font-black text-base sm:text-lg shadow-lg hover:bg-[#00905d] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Initialisation...
                        </>
                      ) : (
                        <>
                          Confirmer et payer
                          <CheckCircle2 className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: PROCESSING */}
              {step === 'processing' && method && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-5 text-center py-4"
                >
                  <div className="relative inline-block">
                    <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Loader2 className="w-12 h-12 text-[#00a86b] animate-spin" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-white border-2 border-emerald-200 flex items-center justify-center shadow">
                      {method === 'lightning' ? (
                        <Zap className="w-4 h-4 text-orange-500 fill-orange-400" />
                      ) : method === 'wallet' ? (
                        <WalletIcon className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Phone className="w-4 h-4 text-yellow-600" />
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-slate-900">Paiement en cours...</h3>
                    <p className="mt-1 text-sm font-bold text-slate-600">
                      {method === 'wallet'
                        ? 'Débit en cours sur votre wallet Santé+...'
                        : method === 'lightning'
                        ? 'Veuillez scanner le QR Code Lightning avec votre wallet.'
                        : 'Veuillez valider la transaction sur votre téléphone ' +
                          METHOD_META[method].abbr +
                          '.'}
                    </p>
                  </div>

                  <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-left space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Montant
                      </span>
                      <span className="text-lg font-black text-slate-900">
                        {totalXof.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Facture
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {invoice.id.substring(0, 16)}...
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Méthode
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        {METHOD_META[method].label}
                      </span>
                    </div>
                  </div>

                  {method === 'lightning' && paymentResult?.bolt11 && (
                    <div className="rounded-3xl bg-white border-2 border-orange-200 p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-center">
                        <div className="p-3 bg-white rounded-2xl border border-slate-100">
                          <QRCodeSVG
                            value={paymentResult.bolt11}
                            size={180}
                            level="M"
                            includeMargin
                            fgColor="#0a1f1a"
                          />
                        </div>
                      </div>
                      <div className="space-y-1 text-center">
                        <p className="text-xs font-black uppercase tracking-wider text-orange-700">
                          Montant Lightning
                        </p>
                        <p className="text-2xl font-black text-slate-900">
                          {Number(paymentResult.amountSats || 0).toLocaleString('fr-FR')}{' '}
                          <span className="text-base font-bold text-orange-700">SATS</span>
                        </p>
                        <p className="text-[10px] font-bold text-slate-500 break-all font-mono">
                          {paymentResult.bolt11.slice(0, 36)}...
                        </p>
                      </div>
                    </div>
                  )}

                  {method !== 'wallet' &&
                    method !== 'lightning' &&
                    paymentResult?.paymentUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            paymentResult.paymentUrl!,
                            '_blank',
                            'noopener,noreferrer'
                          )
                        }
                        className="w-full min-h-[56px] rounded-2xl bg-white border-2 border-emerald-500 text-emerald-700 font-black hover:bg-emerald-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        Ouvrir la page de paiement
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    )}

                  <p className="text-[11px] font-bold text-slate-500">
                    Attente de confirmation... Ne fermez pas cette fenêtre.
                  </p>
                </motion.div>
              )}

              {/* STEP 4: SUCCESS */}
              {step === 'success' && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5 text-center py-2"
                >
                  <div className="relative inline-block">
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 250, damping: 18 }}
                      className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-14 h-14 text-[#00a86b]" />
                    </motion.div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Paiement réussi !</h3>
                    <p className="mt-1 text-sm font-bold text-slate-600">
                      Votre facture a été acquittée avec succès.
                    </p>
                  </div>
                  <div className="rounded-3xl bg-gradient-to-br from-emerald-700 to-teal-500 p-5 text-white shadow-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-100/90">
                        Facture réglée
                      </span>
                      <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                    </div>
                    <p className="text-4xl font-black tracking-tight">
                      {totalXof.toLocaleString('fr-FR')}{' '}
                      <span className="text-xl font-bold opacity-90">FCFA</span>
                    </p>
                    <p className="text-xs font-bold text-emerald-100/90 text-left">
                      {invoice.hospitalName}
                    </p>
                    <div className="h-px bg-white/20 my-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-100/90">
                        Nouveau solde wallet
                      </span>
                      <span className="text-xl font-black">
                        {(newBalance ?? 0).toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="w-full min-h-[56px] rounded-2xl bg-[#00a86b] text-white font-black text-lg shadow-lg hover:bg-[#00905d] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Terminer
                  </button>
                </motion.div>
              )}

              {/* STEP 5: FAILURE */}
              {step === 'failure' && (
                <motion.div
                  key="failure"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5 text-center py-2"
                >
                  <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                    <XCircle className="w-14 h-14 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Paiement échoué</h3>
                    <p className="mt-2 text-sm font-bold text-slate-600 px-2">
                      {error || "Une erreur est survenue lors du paiement."}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-left space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-red-700">
                        Montant
                      </span>
                      <span className="text-sm font-black text-slate-900">
                        {totalXof.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-red-700">
                        Méthode
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        {method ? METHOD_META[method].label : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStep('method');
                        setError(null);
                      }}
                      className="flex-1 min-h-[56px] rounded-2xl bg-white border-2 border-slate-200 text-slate-800 font-black hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-5 h-5" />
                      Choisir une autre méthode
                    </button>
                    <button
                      type="button"
                      onClick={close}
                      className="flex-1 min-h-[56px] rounded-2xl bg-[#00a86b] text-white font-black text-base shadow-lg hover:bg-[#00905d] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      Fermer
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
