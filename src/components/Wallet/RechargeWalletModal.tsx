import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, CheckCircle2, XCircle, ArrowRight, Loader2, Phone, Zap,
  RefreshCw, MessageCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiClient } from '../../services/api';
import type { PaymentMethod, WalletRecharge } from '../../types';

type Step = 'amount' | 'method' | 'processing' | 'success' | 'failure';

interface RechargeWalletModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (newBalanceXof?: number) => void;
  currentBalanceXof?: number;
  patientPhone?: string;
}

const QUICK_AMOUNTS = [5000, 10000, 25000];

const METHOD_KEYS = ['mtn', 'moov', 'celtiis', 'lightning'] as const;
type MethodKey = typeof METHOD_KEYS[number];

const METHOD_META: Record<MethodKey, {
  label: string;
  tagline: string;
  color: string;
  accent: string;
  abbr: string;
  needPhone: boolean;
}> = {
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
    accent: 'bg-emerald-600',
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

export default function RechargeWalletModal({
  open,
  onClose,
  onSuccess,
  currentBalanceXof = 0,
  patientPhone,
}: RechargeWalletModalProps) {
  const [step, setStep] = useState<Step>('amount');
  const [amountStr, setAmountStr] = useState<string>('5000');
  const [amount, setAmount] = useState<number>(5000);
  const [method, setMethod] = useState<MethodKey | null>(null);
  const [phone, setPhone] = useState<string>(patientPhone || '');
  const [error, setError] = useState<string | null>(null);
  const [rechargeData, setRechargeData] = useState<WalletRecharge & {
    paymentUrl?: string;
    bolt11?: string;
    paymentHash?: string;
    amountSats?: number;
    expiresAt?: number;
  } | null>(null);
  const [newBalance, setNewBalance] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollRef = useRef<number | null>(null);

  const resetState = () => {
    setStep('amount');
    setAmount(5000);
    setAmountStr('5000');
    setMethod(null);
    setError(null);
    setRechargeData(null);
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
    } else {
      if (patientPhone) setPhone(patientPhone);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
     
  }, [open]);

  const handleQuickAmount = (v: number) => {
    setAmount(v);
    setAmountStr(String(v));
  };

  const handleAmountInput = (v: string) => {
    setAmountStr(v);
    const n = parseInt(v.replace(/[^\d]/g, ''), 10);
    if (!isNaN(n) && n > 0) setAmount(n);
    else setAmount(0);
  };

  const canGoMethod = amount >= 100;

  const goMethod = () => {
    if (!canGoMethod) return;
    setError(null);
    setStep('method');
  };

  const canSubmit =
    !!method &&
    amount >= 100 &&
    (METHOD_META[method].needPhone ? phone.replace(/[^\d]/g, '').length >= 8 : true);

  const handleSubmit = async () => {
    if (!canSubmit || !method || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    setStep('processing');
    try {
      const resp = await apiClient.walletRecharge(
        amount,
        method as any,
        method === 'lightning' ? 'lnbits' : method,
        phone
      );
      setRechargeData(resp);

      if (method === 'lightning') {
        startLightningPolling(resp);
      } else if (resp.paymentUrl) {
        window.open(resp.paymentUrl, '_blank', 'noopener,noreferrer');
        startStatusPolling();
      } else {
        startStatusPolling();
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.message ||
          "Erreur lors de l'initialisation du paiement"
      );
      setStep('failure');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startLightningPolling = (r: typeof rechargeData) => {
    if (!r?.paymentHash) return;
    if (pollRef.current) clearInterval(pollRef.current);
    let ticks = 0;
    const MAX_TICKS = 450;
    pollRef.current = window.setInterval(async () => {
      try {
        ticks++;
        if (!r?.paymentHash) return;
        const list = await apiClient.getWalletRecharges(10);
        const match = list.find(
          (x) => x.paymentHash === r.paymentHash || x.id === r.id
        );
        if (match && match.status === 'COMPLETED') {
          finishSuccess();
          return;
        }
        if (match && match.status === 'FAILED') {
          setError('Paiement Lightning échoué ou expiré.');
          setStep('failure');
          return;
        }
        if (ticks >= MAX_TICKS) {
          setError('Temps de paiement dépassé. Veuillez réessayer.');
          setStep('failure');
        }
      } catch {
        /* ignore */
      }
    }, 2500);
  };

  const startStatusPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    let ticks = 0;
    const MAX_TICKS = 120;
    pollRef.current = window.setInterval(async () => {
      try {
        ticks++;
        if (!rechargeData?.id) return;
        const list = await apiClient.getWalletRecharges(10);
        const match = list.find(
          (x) =>
            x.id === rechargeData.id ||
            (rechargeData.transactionId && x.transactionId === rechargeData.transactionId)
        );
        if (match && match.status === 'COMPLETED') {
          finishSuccess();
          return;
        }
        if (match && match.status === 'FAILED') {
          setError('Le paiement Mobile Money a été refusé ou a échoué.');
          setStep('failure');
          return;
        }
        if (ticks >= MAX_TICKS) {
          setError(
            'Paiement en attente de validation. Si vous avez validé sur votre téléphone, rafraîchissez dans quelques instants.'
          );
          setStep('failure');
        }
      } catch {
        /* ignore */
      }
    }, 2500);
  };

  const finishSuccess = async () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    try {
      const bal = await apiClient.getWalletBalance();
      setNewBalance(bal.balanceXof);
      onSuccess?.(bal.balanceXof);
    } catch {
      setNewBalance(currentBalanceXof + amount);
      onSuccess?.(currentBalanceXof + amount);
    }
    setStep('success');
  };

  const close = () => {
    resetState();
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        >
          <div className="sticky top-0 bg-white z-10 px-5 sm:px-6 pt-5 sm:pt-6 pb-3 border-b border-slate-100 flex items-center justify-between rounded-t-3xl">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Recharger mon wallet
              </h2>
              <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-500">
                Solde actuel : <span className="text-emerald-700">{currentBalanceXof.toLocaleString('fr-FR')} FCFA</span>
              </p>
            </div>
            <button
              onClick={close}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            <AnimatePresence mode="wait">
              {/* ÉTAPE 1: MONTANT */}
              {step === 'amount' && (
                <motion.div
                  key="amount"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-5"
                >
                  <div>
                    <label className="text-sm font-black text-slate-800 uppercase tracking-wider">
                      Choisir le montant
                    </label>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3">
                      {QUICK_AMOUNTS.map((v) => {
                        const active = amount === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => handleQuickAmount(v)}
                            className={`min-h-[56px] rounded-2xl font-black text-sm sm:text-base transition-all cursor-pointer border-2 ${
                              active
                                ? 'bg-[#00a86b] text-white border-[#00a86b] shadow-md scale-[1.02]'
                                : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50'
                            }`}
                          >
                            {v.toLocaleString('fr-FR')}
                            <span className="block text-[10px] sm:text-xs font-bold opacity-80 -mt-0.5">FCFA</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-black text-slate-800 uppercase tracking-wider">
                      Ou montant personnalisé
                    </label>
                    <div className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-slate-200 focus-within:border-emerald-500 bg-white overflow-hidden transition">
                      <span className="pl-4 font-black text-emerald-700 text-lg">FCFA</span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        value={amountStr}
                        onChange={(e) => handleAmountInput(e.target.value)}
                        placeholder="Ex: 15000"
                        className="w-full min-h-[56px] px-3 text-xl font-black text-slate-900 bg-transparent outline-none"
                      />
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      Minimum 100 FCFA · Maximum 100 000 000 FCFA
                    </p>
                  </div>

                  <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-700">
                        Vous allez recharger
                      </span>
                      <Zap className="w-4 h-4 text-emerald-600 fill-emerald-500" />
                    </div>
                    <div className="mt-2 text-3xl font-black text-emerald-900 tracking-tight">
                      {amount.toLocaleString('fr-FR')}{' '}
                      <span className="text-base font-bold text-emerald-700">FCFA</span>
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-emerald-700">
                      ≈ {Math.round(amount * 1.666).toLocaleString('fr-FR')} sats · crédit immédiat après validation
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={goMethod}
                    disabled={!canGoMethod}
                    className="w-full min-h-[56px] rounded-2xl bg-[#00a86b] text-white font-black text-base sm:text-lg shadow-lg hover:bg-[#00905d] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Continuer
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </motion.div>
              )}

              {/* ÉTAPE 2: MÉTHODE */}
              {step === 'method' && (
                <motion.div
                  key="method"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 border border-emerald-100">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-700">
                        Montant : {amount.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  </div>

                  <label className="text-sm font-black text-slate-800 uppercase tracking-wider">
                    Choisir un moyen de paiement
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(METHOD_META) as Array<keyof typeof METHOD_META>).map((m) => {
                      const meta = METHOD_META[m];
                      const selected = method === m;
                      return (
                        <button
                          type="button"
                          key={m}
                          onClick={() => setMethod(m)}
                          className={`min-h-[100px] sm:min-h-[112px] rounded-2xl border-2 p-3 sm:p-4 text-left transition-all cursor-pointer ${
                            selected
                              ? `${meta.color} ring-2 ring-offset-1 ring-emerald-500 shadow-md scale-[1.01]`
                              : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl ${meta.accent} text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0`}
                            >
                              {meta.abbr === '₿' ? (
                                <Zap className="w-5 h-5" />
                              ) : (
                                meta.abbr
                              )}
                            </div>
                            {selected && (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 ml-auto" />
                            )}
                          </div>
                          <div className="mt-3">
                            <p className="font-black text-sm leading-tight">{meta.label}</p>
                            <p className="text-[11px] font-bold opacity-70 mt-0.5 leading-tight">
                              {meta.tagline}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {method && METHOD_META[method].needPhone && (
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
                        Format Bénin (8 chiffres) · Un SMS de validation vous sera envoyé.
                      </p>
                    </div>
                  )}

                  {method === 'lightning' && (
                    <div className="rounded-2xl bg-orange-50 border border-orange-200 p-4 text-xs font-bold text-orange-900 leading-relaxed">
                      <strong className="font-black">⚡ Lightning Network</strong> — Paiement Bitcoin
                      instantané sans frais. Un QR Code Lightning vous sera présenté à l'étape
                      suivante.
                    </div>
                  )}

                  <div className="flex gap-2 sm:gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep('amount')}
                      className="flex-1 min-h-[56px] rounded-2xl bg-white border-2 border-slate-200 text-slate-800 font-black hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      ← Retour
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
                          Payer {amount.toLocaleString('fr-FR')} FCFA
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ÉTAPE 3: PROCESSING */}
              {step === 'processing' && (
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
                      ) : (
                        <Phone className="w-4 h-4 text-yellow-600" />
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-slate-900">Paiement en cours...</h3>
                    <p className="mt-1 text-sm font-bold text-slate-600">
                      {method === 'lightning'
                        ? 'Veuillez scanner le QR Code Lightning ci-dessous avec votre wallet.'
                        : 'Veuillez valider la transaction sur votre téléphone ' +
                          (method ? METHOD_META[method].abbr : '') +
                          '.'}
                    </p>
                  </div>

                  <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 text-left space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Montant
                      </span>
                      <span className="text-lg font-black text-slate-900">
                        {amount.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                        Méthode
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        {method ? METHOD_META[method].label : '—'}
                      </span>
                    </div>
                    {rechargeData?.transactionId && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Référence
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {rechargeData.transactionId.slice(0, 18)}...
                        </span>
                      </div>
                    )}
                  </div>

                  {method === 'lightning' && rechargeData?.bolt11 && (
                    <div className="rounded-3xl bg-white border-2 border-orange-200 p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-center">
                        <div className="p-3 bg-white rounded-2xl border border-slate-100">
                          <QRCodeSVG
                            value={rechargeData.bolt11}
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
                          {Number(rechargeData.amountSats || 0).toLocaleString('fr-FR')}{' '}
                          <span className="text-base font-bold text-orange-700">SATS</span>
                        </p>
                        <p className="text-[10px] font-bold text-slate-500 break-all font-mono">
                          {rechargeData.bolt11.slice(0, 36)}...
                        </p>
                      </div>
                    </div>
                  )}

                  {method !== 'lightning' && rechargeData?.paymentUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(rechargeData.paymentUrl!, '_blank', 'noopener,noreferrer')}
                      className="w-full min-h-[56px] rounded-2xl bg-white border-2 border-emerald-500 text-emerald-700 font-black hover:bg-emerald-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Ouvrir la page de paiement
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  )}

                  <p className="text-[11px] font-bold text-slate-500">
                    Attente de confirmation... Votre solde sera crédité automatiquement.
                  </p>
                </motion.div>
              )}

              {/* ÉTAPE 4: SUCCÈS */}
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
                      Votre wallet a bien été crédité.
                    </p>
                  </div>
                  <div className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-500 p-5 text-white shadow-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-100/90">
                        Montant rechargé
                      </span>
                    </div>
                    <p className="text-4xl font-black tracking-tight">
                      +{amount.toLocaleString('fr-FR')}{' '}
                      <span className="text-xl font-bold opacity-90">FCFA</span>
                    </p>
                    <div className="h-px bg-white/20 my-2" />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-100/90">
                        Nouveau solde
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

              {/* ÉTAPE 5: ÉCHEC */}
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
                  <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-left space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-red-700">
                        Montant demandé
                      </span>
                      <span className="text-sm font-black text-slate-900">
                        {amount.toLocaleString('fr-FR')} FCFA
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
                      Réessayer
                    </button>
                    <button
                      type="button"
                      onClick={close}
                      className="flex-1 min-h-[56px] rounded-2xl bg-[#00a86b] text-white font-black text-base shadow-lg hover:bg-[#00905d] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Contacter le support
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="w-full text-xs font-bold text-slate-500 hover:text-slate-700 transition cursor-pointer"
                  >
                    Fermer cette fenêtre
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
