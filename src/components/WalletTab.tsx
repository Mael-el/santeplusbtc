import React, { useState, useEffect } from 'react';
import { Invoice, AccessRequest, Patient, MedicalDocument, Appointment } from '../types';
import { 
  QrCode, Folder, FileText, Building2, Bell, AlarmClock,
  Calendar, Heart, User, Wallet, ArrowRight,
  PlusCircle, Download, CheckCircle2, ShieldCheck, 
  Sparkles, X, Volume2, VolumeX, AlertCircle, Eye, Printer, Zap, RefreshCw,
  Users, Plus, Award, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import { Banner } from 'orbit-design-system';
import RechargeWalletModal from './Wallet/RechargeWalletModal';

interface WalletTabProps {
  balance: number;
  setBalance: React.Dispatch<React.SetStateAction<number>>;
  satoshiBalance?: number;
  setSatoshiBalance?: React.Dispatch<React.SetStateAction<number>>;
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  accessRequests: AccessRequest[];
  onApproveAccess: (requestId: string) => void;
  onRejectAccess: (requestId: string) => void;
  patientUser?: Patient | null;
  customDocuments?: MedicalDocument[];
  appointments?: Appointment[];
  onNavigateToMap?: () => void;
  onNavigateToAppointments?: () => void;
  onOpenProfile?: () => void;
  clinicalRecord?: { consultations: any[]; prescriptions: any[] };
  notifications?: Array<{ id: string; title: string; message: string; timestamp: string; read: boolean }>;
}

export default function WalletTab({
  balance,
  setBalance,
  satoshiBalance = 0,
  setSatoshiBalance,
  invoices,
  onSelectInvoice,
  accessRequests,
  onApproveAccess,
  onRejectAccess,
  patientUser,
  customDocuments = [],
  appointments = [],
  onNavigateToMap,
  onNavigateToAppointments,
  onOpenProfile,
  clinicalRecord = { consultations: [], prescriptions: [] },
  notifications = []
}: WalletTabProps) {
  
  // Active sub-modal states for the 8 cards (Tontine retirée)
  const [activeModal, setActiveModal] = useState<
    'qr' | 'medical-record' | 'prescriptions' | 'payments' | 
    'appointments' | 'blood' | 'topup' | null
  >(null);
  const [prescriptionTab, setPrescriptionTab] = useState<'active' | 'history' | 'renewable'>('active');
  const [medicalTab, setMedicalTab] = useState<'all' | 'consultations' | 'prescriptions' | 'analyses' | 'exams' | 'blood' | 'vaccines'>('all');
  const [medicalPeriod, setMedicalPeriod] = useState<'all' | '6months' | '1year'>('all');

  // Audio Speech state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Top-up wallet form
  const [topUpAmount, setTopUpAmount] = useState('5000');
  const [topUpMethod, setTopUpMethod] = useState<'mtn' | 'moov' | 'lightning'>('mtn');
  const [isProcessingTopUp, setIsProcessingTopUp] = useState(false);
  const [topUpSuccess, setTopUpSuccess] = useState(false);

  // Selected document for view/print
  const [selectedDoc, setSelectedDoc] = useState<MedicalDocument | null>(null);

  // --- DON DE SANG CITOYEN ---
  const [bloodStatus, setBloodStatus] = useState<any>({
    eligibleToDonate: true,
    lastDonationDate: null,
    nextEligibleDate: null,
    totalDonations: 0,
    totalVolume: 0
  });
  const [bloodHistory, setBloodHistory] = useState<any[]>([]);
  const [bloodLoading, setBloodLoading] = useState(false);
  const [bloodDonating, setBloodDonating] = useState(false);
  const [bloodSuccessMsg, setBloodSuccessMsg] = useState<string | null>(null);

  const userName = patientUser?.name ? patientUser.name.split(' ')[0] : 'Patient';
  const fullName = patientUser?.name || 'Patient';
  const npi = patientUser?.npi || 'NPI non attribué';
  const bloodGroup = patientUser?.bloodGroup || 'Non renseigné';
  const qrIdentity = patientUser?.qrCodeHash || npi;
  const qrValue = `SANTE-PLUS-BENIN:NPI=${npi};PATIENT=${fullName};BLOOD=${bloodGroup};QR_HASH=${qrIdentity}`;

  // Synchronisation avec les APIs backend Don de Sang
  useEffect(() => {
    if (activeModal === 'blood') {
      const fetchBlood = async () => {
        try {
          const [statusRes, histRes] = await Promise.all([
            fetch('/api/blood/donor-status', { credentials: 'include' }),
            fetch('/api/blood/history', { credentials: 'include' })
          ]);
          if (statusRes.ok) {
            const sData = await statusRes.json();
            if (sData.success && sData.data) setBloodStatus(sData.data);
          }
          if (histRes.ok) {
            const hData = await histRes.json();
            if (hData.success && Array.isArray(hData.data)) setBloodHistory(hData.data);
          }
        } catch {
          // Fallback silencieux sur le dataset local
        }
      };
      fetchBlood();
    }
  }, [activeModal]);

  const handleDonateBlood = async () => {
    setBloodDonating(true);
    try {
      const res = await fetch('/api/blood/donate', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          donorName: fullName,
          bloodType: bloodGroup,
          quantity: 450,
          donorPhone: patientUser?.phone || '+229 01 97 88 55 44'
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setBloodStatus((prev: any) => ({
          ...prev,
          totalDonations: (prev.totalDonations || 0) + 1,
          totalVolume: (prev.totalVolume || 0) + 450,
          lastDonationDate: new Date().toISOString().split('T')[0]
        }));
        setBloodHistory(prev => [
          {
            id: data.data.id,
            date: new Date().toISOString().split('T')[0],
            bloodType: bloodGroup,
            quantity: 450,
            status: 'validated',
            blockchainHash: data.data.blockchainHash
          },
          ...prev
        ]);
        setBloodSuccessMsg('Engagement de don enregistré avec succès.');
        setTimeout(() => setBloodSuccessMsg(null), 5000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setBloodDonating(false);
    }
  };

  // Audio Read Aloud for low-literacy users
  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (isPlayingAudio) {
      setIsPlayingAudio(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.95;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    setIsPlayingAudio(true);
    window.speechSynthesis.speak(utterance);
  };

  // Trigger audio summary of the 9 cards
  const handleReadDashboard = () => {
    const summary = `Bonjour ${userName}. Votre solde est de ${balance.toLocaleString('fr-FR')} Francs CFA. Vous avez 8 services disponibles : Mon QR Code pour vous identifier à l'hôpital, votre Dossier Médical, vos Ordonnances avec une nouvelle prescription, vos Paiements de soins, vos Rendez-vous prévus, la liste des Hôpitaux, le Don de Sang avec votre groupe ${bloodGroup}, et votre Profil personnel. Touchez n'importe quelle carte pour l'ouvrir.`;
    speakText(summary);
  };

  // Top Up Wallet Handler
  const handleTopUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseInt(topUpAmount, 10);
    if (isNaN(amountNum) || amountNum <= 0) return;

    setIsProcessingTopUp(true);
    setTimeout(() => {
      setIsProcessingTopUp(false);
      const newBal = balance + amountNum;
      setBalance(newBal);
      if (setSatoshiBalance) {
        setSatoshiBalance(prev => prev + Math.floor(amountNum * 1.6));
      }
      setTopUpSuccess(true);
      speakText(`Recharge effectuée avec succès. Votre nouveau solde est de ${newBal.toLocaleString('fr-FR')} Francs CFA.`);
      setTimeout(() => {
        setTopUpSuccess(false);
        setActiveModal(null);
      }, 1500);
    }, 1200);
  };

  // Download Medical Document PDF
  const handleDownloadPDF = (docObj: MedicalDocument) => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setTextColor(5, 150, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('SANTÉ+ BÉNIN', 20, 25);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('RÉSEAU MÉDICAL NATIONAL ET SÉCURISÉ', 20, 31);
    doc.line(20, 35, 190, 35);
    
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(docObj.title.toUpperCase(), 20, 48);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Patient : ${fullName} (NPI : ${npi})`, 20, 58);
    doc.text(`Établissement : ${docObj.hospitalName || 'Non renseigné'}`, 20, 65);
    doc.text(`Médecin : ${docObj.doctorName || 'Non renseigné'}`, 20, 72);
    doc.text(`Date : ${docObj.date || new Date().toLocaleDateString('fr-FR')}`, 20, 79);

    let y = 92;
    doc.setFont('helvetica', 'bold');
    doc.text('ÉLÉMENTS / ACTES PRESCRITS :', 20, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    (docObj.items || []).forEach((item, i) => {
      doc.text(`• ${item.name} - ${(item.priceXOF || 0).toLocaleString('fr-FR')} FCFA`, 25, y);
      y += 7;
    });

    doc.setTextColor(5, 150, 105);
    doc.setFont('helvetica', 'bold');
    doc.text(`DOCUMENT OFFICIEL SANTE+`, 20, y + 15);

    doc.save(`SantePlus_${docObj.title.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="page-enter patient-space role-dashboard w-full max-w-7xl mx-auto space-y-3">
      
      {/* ---------------------------------------------------- */}
      {/* TOP PATIENT HEALTH IDENTIFIER & WALLET BAR           */}
      {/* ---------------------------------------------------- */}
      <div className="patient-header bg-white/90 backdrop-blur-xs p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        
        {/* Patient Identity */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0f766e] to-[#0e7490] text-white flex items-center justify-center font-black text-sm shadow-sm shrink-0">
            {patientUser?.name ? patientUser.name.substring(0, 2).toUpperCase() : 'JD'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 font-sans tracking-tight">
                Bonjour, {userName}
              </h1>
              <button
                onClick={handleReadDashboard}
                className="p-1.5 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 rounded-full transition-all cursor-pointer"
                title="Écouter le résumé de vos services"
              >
                {isPlayingAudio ? <VolumeX className="w-4 h-4 text-red-500 animate-pulse" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
            
            {/* Metadata Pills */}
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md font-mono">
                NPI {npi}
              </span>
              <span className="text-[11px] font-black text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                Groupe {bloodGroup}
              </span>
              <span className="hidden sm:inline-flex text-[11px] font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded-md items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-cyan-600" />
                Passeport e-Santé Certifié
              </span>
            </div>
          </div>
        </div>

        {/* Solde Portefeuille & Recharge Rapide */}
        <div 
          onClick={() => setActiveModal('topup')}
          className="patient-wallet w-full md:w-auto bg-gradient-to-r from-[#fff7ed] to-[#ffedd5] hover:from-[#ffedd5] hover:to-[#fed7aa] border border-orange-200/80 p-3 sm:p-3.5 rounded-xl flex items-center justify-between md:justify-start gap-4 cursor-pointer transition-all hover:shadow-xs group shrink-0"
          title="Cliquez pour recharger votre solde"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ea580c] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-900/80 block leading-none">
                SOLDE DISPONIBLE
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-sans tracking-tight mt-0.5">
                {balance.toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-600">FCFA</span>
              </div>
              <div className="text-[11px] font-bold text-orange-800 flex items-center gap-1">
                <Zap className="w-3 h-3 fill-orange-600 text-orange-600" />
                <span>{satoshiBalance.toLocaleString('fr-FR')} Sats</span>
              </div>
            </div>
          </div>

          <div className="text-xs font-extrabold text-orange-800 bg-white/90 px-2.5 py-1.5 rounded-lg border border-orange-200 shadow-xs group-hover:bg-white transition-colors">
            Recharger +
          </div>
        </div>

      </div>

      <section className="patient-pass-card rounded-[32px_32px_8px_32px] bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 p-4 text-white shadow-xl sm:p-6">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">Mon pass médical</p>
            <h2 className="mt-1 text-2xl font-black text-white">Votre santé pulse.</h2>
            <p className="mt-1 text-sm text-emerald-50">{npi} · {fullName}</p>
            <p className="mt-2 text-xs font-bold text-emerald-100">Groupe {bloodGroup} · Dossier sécurisé</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => setActiveModal('qr')} className="rounded-xl bg-white px-4 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-50">Ouvrir le QR</button>
              <button onClick={() => setActiveModal('medical-record')} className="rounded-xl border border-white/50 px-4 py-2 text-xs font-black text-white hover:bg-white/10">Voir mon dossier</button>
            </div>
          </div>
        </div>
      </section>

      {notifications.some(notification => !notification.read) && (
        <div
          onClick={() => setActiveModal('medical-record')}
          className="w-full cursor-pointer rounded-2xl shadow-xs hover:brightness-[0.98]"
        >
          <Banner
            styleVariant="positive"
            layout="compact"
            title="Dossier médical mis à jour"
            body="Ouvrez votre dossier pour voir la nouvelle consultation et le traitement transmis par votre médecin."
            showCloseButton={false}
          />
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 9 ACTION CARDS GRID (CALIBRÉE & COMPACTE)            */}
      {/* ---------------------------------------------------- */}
      <div className="patient-services grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        
        {/* CARD 1: MON QR CODE */}
        <div 
          onClick={() => setActiveModal('qr')}
          className="stagger-item sante-card p-3 bg-white flex flex-col justify-between min-h-[104px] sm:h-[112px] cursor-pointer group hover:border-emerald-500 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <QrCode className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="text-[13px] font-black text-slate-900 font-sans">Mon QR Code</h3>
          </div>
        </div>

        {/* CARD 2: DOSSIER MÉDICAL */}
        <div 
          onClick={() => setActiveModal('medical-record')}
          className="stagger-item sante-card p-3 bg-white flex flex-col justify-between min-h-[104px] sm:h-[112px] cursor-pointer group hover:border-blue-500 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Folder className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="text-[15px] font-black text-slate-900 font-sans">Dossier Médical</h3>
          </div>
        </div>

        {/* CARD 3: ORDONNANCES */}
        <div 
          onClick={() => setActiveModal('prescriptions')}
          className="stagger-item sante-card p-3 bg-white flex flex-col justify-between min-h-[104px] sm:h-[112px] cursor-pointer group hover:border-red-400 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            {clinicalRecord.prescriptions.length > 0 && (
              <span className="px-2 py-0.5 bg-red-600 text-white font-extrabold text-[10px] rounded-full uppercase tracking-wider shadow-xs animate-pulse">
                {clinicalRecord.prescriptions.length} NOUVELLE{clinicalRecord.prescriptions.length > 1 ? 'S' : ''}
              </span>
            )}
          </div>
          <div>
            <h3 className="text-[15px] font-black text-slate-900 font-sans">Ordonnances</h3>
          </div>
        </div>

        {/* CARD 4: PAIEMENTS */}
        <div 
          onClick={() => setActiveModal('payments')}
          className="stagger-item sante-card p-3 bg-white flex flex-col justify-between min-h-[104px] sm:h-[112px] cursor-pointer group hover:border-slate-400 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800 group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="text-[15px] font-black text-slate-900 font-sans">Paiements</h3>
          </div>
        </div>

        {/* CARD 5: RENDEZ-VOUS */}
        <div 
          onClick={() => setActiveModal('appointments')}
          className="stagger-item sante-card p-3 bg-white flex flex-col justify-between min-h-[104px] sm:h-[112px] cursor-pointer group hover:border-emerald-500 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Demain, 14:00
            </span>
          </div>
          <div>
            <h3 className="text-[15px] font-black text-slate-900 font-sans">Rendez-vous</h3>
          </div>
        </div>

        {/* CARD 6: HÔPITAUX */}
        <div 
          onClick={() => {
            if (onNavigateToMap) onNavigateToMap();
            else setActiveModal('medical-record');
          }}
          className="stagger-item sante-card p-3 bg-white flex flex-col justify-between min-h-[104px] sm:h-[112px] cursor-pointer group hover:border-blue-500 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Building2 className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="text-[15px] font-black text-slate-900 font-sans">Hôpitaux</h3>
          </div>
        </div>

        {/* CARD 7: DON DE SANG */}
        <div 
          onClick={() => setActiveModal('blood')}
          className="stagger-item sante-card p-3 bg-white flex flex-col justify-between min-h-[104px] sm:h-[112px] cursor-pointer group hover:border-red-500 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Heart className="w-5 h-5 fill-red-500 text-red-500" />
            </div>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-800 font-black text-xs rounded-full border border-slate-200">
              {bloodGroup}
            </span>
          </div>
          <div>
            <h3 className="text-[15px] font-black text-slate-900 font-sans">Don de Sang</h3>
          </div>
        </div>

        {/* CARD 8: MON PROFIL */}
        <div 
          onClick={() => {
            if (onOpenProfile) onOpenProfile();
            else setActiveModal('qr');
          }}
          className="stagger-item sante-card p-3 bg-white flex flex-col justify-between min-h-[104px] sm:h-[112px] cursor-pointer group hover:border-slate-500 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <User className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
          </div>
          <div>
            <h3 className="text-[15px] font-black text-slate-900 font-sans">Mon Profil</h3>
          </div>
        </div>

      </div>

      <section className="patient-notification-list rounded-[32px_32px_8px_32px] border border-emerald-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">À ne pas manquer</p>
            <h2 className="mt-1 text-xl font-black text-emerald-950">Notifications récentes</h2>
          </div>
          <Bell className="h-5 w-5 text-emerald-600" />
        </div>
        {notifications.length === 0 ? (
          <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Aucune notification pour le moment.</p>
        ) : (
          <div className="mt-3 divide-y divide-emerald-50">
            {notifications.slice(0, 3).map(notification => (
              <button key={notification.id} onClick={() => setActiveModal('medical-record')} className="flex min-h-[60px] w-full items-center gap-3 py-3 text-left hover:bg-emerald-50/60">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Bell className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-emerald-950">{notification.title}</strong><span className="block truncate text-xs text-emerald-700">{notification.message}</span></span>
                <span className="shrink-0 text-[10px] text-emerald-600">{new Date(notification.timestamp).toLocaleDateString('fr-FR')}</span>
              </button>
            ))}
          </div>
        )}
      </section>


      {/* ---------------------------------------------------- */}
      {/* MODAL 1: MON QR CODE VISUAL PASS                     */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {activeModal === 'qr' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl text-center space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-gray-900">Pass Médical Sécurisé</h3>
                <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center">
                <QRCodeSVG 
                  value={qrValue}
                  size={190}
                  level="H"
                  includeMargin
                />
                <span className="mt-3 font-mono font-bold text-xs tracking-wider text-emerald-900">{npi}</span>
                <span className="text-[11px] text-emerald-700 font-bold">{fullName} • Groupe {bloodGroup}</span>
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                Présentez ce QR Code au médecin ou à l'accueil de l'hôpital pour une admission instantanée sans saisie manuelle.
              </p>

              <button
                onClick={() => {
                  speakText(`Voici votre passeport médical numérique pour ${fullName}, identifiant ${npi}. Il peut être scanné directement par votre hôpital.`);
                }}
                className="w-full py-3 bg-[#059669] hover:bg-[#047857] text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>Écouter les détails audio</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------- */}
      {/* MODAL 2: ORDONNANCES & PRESCRIPTIONS                 */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {activeModal === 'prescriptions' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                <div>
                  <h3 className="text-2xl font-black text-emerald-950">Mes Ordonnances</h3>
                  <p className="text-sm text-emerald-700">Traitements prescrits par vos médecins</p>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="grid grid-cols-3 gap-1 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-1.5">
                {([['active', 'Actives'], ['history', 'Historique'], ['renewable', 'Renouvelables']] as const).map(([tab, label]) => (
                  <button key={tab} type="button" onClick={() => setPrescriptionTab(tab)} className={`min-h-[44px] rounded-xl px-2 py-2 text-xs font-black transition ${prescriptionTab === tab ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-800 hover:bg-white'}`}>
                    {label}
                  </button>
                ))}
              </div>

              {clinicalRecord.prescriptions.filter(prescription => prescriptionTab === 'active' ? prescription.status === 'active' : prescriptionTab === 'history' ? prescription.status !== 'active' : prescription.status !== 'active').map((prescription) => (
                <div key={`clinical-${prescription.id}`} className={`rounded-[32px_32px_8px_32px] border p-4 shadow-sm ${prescriptionTab === 'active' ? 'border-emerald-200 bg-emerald-50/60' : 'border-emerald-100 bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">{prescriptionTab === 'active' ? 'Prescription active' : 'Prescription terminée'}</p>
                      <h4 className="mt-1 text-xl font-black text-emerald-950">{prescription.medication}</h4>
                      <p className="mt-1 text-xs font-bold text-emerald-700">Médecin Santé+ · {prescription.createdAt ? new Date(prescription.createdAt).toLocaleDateString('fr-FR') : 'Date non renseignée'}</p>
                    </div>
                    <FileText className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-3">
                    <p className="text-sm font-black text-emerald-950">{prescription.medication}</p>
                    <p className="mt-1 text-xs font-bold text-emerald-700">{prescription.dosage || 'Posologie à confirmer'} · {prescription.frequency || 'Fréquence à confirmer'}</p>
                  </div>
                  {prescriptionTab === 'active' ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => speakText(`Posologie : ${prescription.medication}. ${prescription.dosage || ''}. ${prescription.frequency || ''}.`)} className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100"><Volume2 className="h-4 w-4" />Écouter la posologie</button>
                      <button type="button" onClick={() => window.print()} className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100"><Download className="h-4 w-4" />Télécharger PDF</button>
                      <button type="button" className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700"><AlarmClock className="h-4 w-4" />Rappel de prise</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setPrescriptionTab('renewable')} className="mt-3 min-h-[44px] rounded-xl border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-50">Voir ou renouveler</button>
                  )}
                </div>
              ))}

              {customDocuments.filter(d => d.type === 'prescription').length === 0 && clinicalRecord.prescriptions.filter(prescription => prescriptionTab === 'active' ? prescription.status === 'active' : prescription.status !== 'active').length === 0 ? (
                <div className="p-5 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center">
                  <p className="text-sm font-bold text-emerald-800">Aucune ordonnance dans cette catégorie.</p>
                  <p className="text-xs text-emerald-700 mt-1">Les prescriptions transmises par votre médecin apparaîtront ici.</p>
                </div>
              ) : null}

              {clinicalRecord.prescriptions.map((prescription) => (
                <div key={`clinical-${prescription.id}`} className="p-4 bg-red-50 border border-red-100 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-bold text-sm text-gray-900">Nouveau traitement</h4>
                    <span className="text-[10px] font-bold uppercase text-red-700">{prescription.status || 'active'}</span>
                  </div>
                  <p className="text-sm font-black text-slate-900">{prescription.medication}</p>
                  <p className="text-xs text-slate-600">{prescription.dosage || 'Posologie à confirmer'} · {prescription.frequency || 'Fréquence à confirmer'}</p>
                  <p className="text-[11px] text-slate-500">Transmis par le médecin {prescription.patientName ? `pour ${prescription.patientName}` : ''}</p>
                </div>
              ))}

              {/* Custom documents if any */}
              {customDocuments.filter(d => d.type === 'prescription').map(doc => (
                <div key={doc.id} className="p-4 bg-white border border-gray-200 rounded-2xl space-y-2">
                  <h4 className="font-bold text-sm text-gray-900">{doc.title}</h4>
                  <p className="text-xs text-gray-500">{doc.doctorName} • {doc.hospitalName}</p>
                  <button
                    onClick={() => handleDownloadPDF(doc)}
                    className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Télécharger
                  </button>
                </div>
              ))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------- */}
      {/* MODAL 3: PAIEMENTS & FACTURES ACQUITTÉES             */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {activeModal === 'payments' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                <div>
                  <h3 className="text-2xl font-black text-emerald-950">Mon Wallet</h3>
                  <p className="text-sm text-emerald-700">Solde, factures et transactions</p>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="rounded-[32px_32px_8px_32px] bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 p-5 text-white shadow-lg">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-100">Solde disponible</p>
                <p className="mt-2 text-4xl font-black">{balance.toLocaleString('fr-FR')} <span className="text-base">FCFA</span></p>
                <p className="mt-1 text-sm font-bold text-emerald-100">≈ {(satoshiBalance / 100000000).toFixed(5)} BTC · {satoshiBalance.toLocaleString('fr-FR')} Sats</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setActiveModal('topup')} className="min-h-[44px] rounded-xl bg-white px-4 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-50"><Zap className="mr-1 inline h-4 w-4" />Recharger</button>
                  <button type="button" className="min-h-[44px] rounded-xl border border-white/50 px-4 py-2 text-xs font-black text-white hover:bg-white/10">Envoyer</button>
                  <button type="button" className="min-h-[44px] rounded-xl border border-white/50 px-4 py-2 text-xs font-black text-white hover:bg-white/10">Recevoir</button>
                </div>
              </div>

              {invoices.find(invoice => !invoice.isPaid) && (
                <div className="rounded-[24px_24px_8px_24px] border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Facture à payer</p>
                  <h4 className="mt-1 text-lg font-black text-emerald-950">{invoices.find(invoice => !invoice.isPaid)?.hospitalName}</h4>
                  <p className="text-xs font-bold text-emerald-700">Consultation · {invoices.find(invoice => !invoice.isPaid)?.date}</p>
                  <p className="mt-2 text-xl font-black text-emerald-950">{invoices.find(invoice => !invoice.isPaid)?.totalXOF.toLocaleString('fr-FR')} FCFA</p>
                  <div className="mt-3 flex flex-wrap gap-2"><button type="button" className="min-h-[44px] rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white">Payer avec Lightning</button><button type="button" className="min-h-[44px] rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-800">Mobile Money</button><button type="button" className="min-h-[44px] rounded-xl bg-white px-3 py-2 text-xs font-black text-emerald-800">Carte</button></div>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm font-black text-emerald-800"><Wallet className="h-4 w-4" />Historique des transactions</div>

              <div className="space-y-3">
                {invoices.length > 0 ? (
                  invoices.map(inv => (
                    <div key={inv.id} className="rounded-[24px_24px_8px_24px] border border-emerald-100 bg-emerald-50/50 p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-md">
                            {inv.isPaid ? 'PAYÉ' : 'À PAYER'}
                          </span>
                          <span className="text-xs font-bold text-emerald-600">{inv.date}</span>
                        </div>
                        <h4 className="mt-1 text-sm font-black text-emerald-950">{inv.hospitalName}</h4>
                        <p className="text-xs font-bold text-emerald-700">Méthode : {inv.paymentMethod} · Réf: {inv.id.substring(0, 10)}</p>
                      </div>
                      <div className="text-right">
                        <span className="block text-sm font-black text-emerald-950">{inv.totalXOF.toLocaleString('fr-FR')} FCFA</span>
                        <button
                          onClick={() => onSelectInvoice(inv)}
                          className="text-[11px] font-black text-emerald-700 hover:underline cursor-pointer"
                        >
                          Voir Reçu
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 p-6 text-center text-sm text-emerald-700">
                    Aucun paiement récent enregistré.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------- */}
      {/* MODAL 5: DON DE SANG CITOYEN                         */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {activeModal === 'blood' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                    <Heart className="w-5 h-5 fill-red-500 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-gray-900 leading-none">Don de Sang Citoyen</h3>
                    <span className="text-[11px] text-gray-500 font-medium">Agence Nationale pour la Transfusion Sanguine</span>
                  </div>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              {bloodSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{bloodSuccessMsg}</span>
                </div>
              )}

              {/* Carte Profil Sanguin */}
              <div className="p-4 bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-red-700 font-extrabold uppercase tracking-wider block">Groupe Sanguin Enregistré</span>
                  <span className="text-2xl font-black text-red-900">{bloodGroup}</span>
                  <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">✓ {bloodStatus?.eligibleToDonate ? 'Éligible au don aujourd\'hui' : 'Délai d\'attente en cours'}</span>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-red-600 text-white font-black flex items-center justify-center text-xl shadow-md">
                  {bloodGroup}
                </div>
              </div>

              {/* Statistiques citoyen */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Dons Effectués</span>
                  <strong className="text-base font-black text-gray-900">{bloodStatus?.totalDonations || 0} dons</strong>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-gray-500 uppercase font-bold block">Volume Total Sauvé</span>
                  <strong className="text-base font-black text-red-700">{bloodStatus?.totalVolume || 0} mL</strong>
                </div>
              </div>

              {/* Urgence actuelle au Bénin */}
              <div className="p-3 bg-red-50/70 border border-red-200/80 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-red-900">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                  <span>Alerte Réserve Banque de Sang — CNHU Cotonou</span>
                </div>
                <p className="text-[11px] text-gray-600">
                  Besoin critique pour les poches de groupe <strong>{bloodGroup}</strong>. Les donneurs sont accueillis au service transfusion 24h/24.
                </p>
              </div>

              {/* Historique des dons */}
              {bloodHistory.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-500">Historique des Dons Certifiés</h4>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {bloodHistory.map((item, idx) => (
                      <div key={item.id || idx} className="p-2.5 bg-slate-50 border border-gray-100 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4 text-red-600" />
                          <div>
                            <strong className="text-gray-900 block font-bold">Don de 450 mL ({item.bloodType})</strong>
                            <span className="text-[10px] text-gray-500">{item.date}</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                          Certifié
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleDonateBlood}
                disabled={bloodDonating}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 transition-all"
              >
                <Heart className="w-4 h-4 fill-white" />
                <span>{bloodDonating ? 'Validation en cours...' : 'Prendre engagement / Déclarer un don'}</span>
              </button>

              <button
                onClick={() => {
                  speakText(`Votre groupe sanguin est ${bloodGroup}. Vous avez réalisé ${bloodStatus?.totalDonations || 0} dons au Bénin. Le CNHU de Cotonou a un besoin urgent de votre groupe aujourd'hui.`);
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-gray-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5 text-red-600" />
                <span>Écouter les alertes et informations de don</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------- */}
      {/* MODAL 6: RECHARGE SOLDE WALLET (NOUVEAU FLUX V3)     */}
      {/* ---------------------------------------------------- */}
      <RechargeWalletModal
        open={activeModal === 'topup'}
        onClose={() => setActiveModal(null)}
        onSuccess={(newBal) => {
          if (typeof newBal === 'number') {
            setBalance(newBal);
            if (setSatoshiBalance) {
              setSatoshiBalance(Math.floor(newBal * 1.6667));
            }
          }
          speakText('Recharge effectuée avec succès. Votre nouveau solde est affiché sur votre portefeuille.');
        }}
        currentBalanceXof={balance}
        patientPhone={patientUser?.phone}
      />

      {/* ---------------------------------------------------- */}
      {/* MODAL 7: DOSSIER MÉDICAL COMPLET                     */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {activeModal === 'medical-record' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                <div>
                  <h3 className="text-2xl font-black text-emerald-950">Mon Dossier Médical</h3>
                  <p className="text-sm text-emerald-700">Historique, traitements et examens sécurisés</p>
                </div>
                <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              {/* Patient Identity Badge */}
              <div className="rounded-[32px_32px_8px_32px] border border-emerald-100 bg-emerald-50 p-4">
                <div>
                  <span className="block text-xl font-black text-emerald-950">{fullName}</span>
                  <span className="text-xs font-bold text-emerald-800">{patientUser?.dateOfBirth ? `${patientUser.dateOfBirth} · ` : ''}{patientUser?.gender || 'Patient'} · Groupe {bloodGroup}</span>
                  <span className="mt-1 block text-xs font-bold text-emerald-700">Allergies : {patientUser?.allergies || 'Aucune'}</span>
                  <span className="mt-1 block text-xs font-mono font-bold text-emerald-700">NPI : {npi}</span>
                </div>
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-3"><div className="flex items-center justify-between text-xs font-black text-emerald-800"><span>État de santé global</span><span>80%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full w-4/5 rounded-full bg-emerald-600" /></div><p className="mt-2 text-xs font-bold text-emerald-700">Bon état général</p></div>
              </div>

              <div className="grid grid-cols-3 gap-1 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-1.5 sm:grid-cols-7">
                {([['all', 'Tout'], ['consultations', 'Consult'], ['prescriptions', 'Presc'], ['analyses', 'Analy'], ['exams', 'Exam'], ['blood', 'Don'], ['vaccines', 'Vacc']] as const).map(([tab, label]) => <button key={tab} type="button" onClick={() => setMedicalTab(tab)} className={`min-h-[44px] rounded-xl px-2 py-2 text-[11px] font-black transition ${medicalTab === tab ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-800 hover:bg-white'}`}>{label}</button>)}
              </div>

              <div className="flex items-center gap-2 text-xs font-black text-emerald-800"><Calendar className="h-4 w-4" />Filtrer la période</div>
              <div className="flex gap-2"><button type="button" onClick={() => setMedicalPeriod('all')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${medicalPeriod === 'all' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800'}`}>Tout</button><button type="button" onClick={() => setMedicalPeriod('6months')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${medicalPeriod === '6months' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800'}`}>6 mois</button><button type="button" onClick={() => setMedicalPeriod('1year')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${medicalPeriod === '1year' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800'}`}>1 an</button></div>

              {/* Consultations et prescriptions synchronisées depuis le dossier central */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase text-emerald-700">Chronologie médicale</h4>
                {clinicalRecord.consultations.length === 0 && clinicalRecord.prescriptions.length === 0 ? (
                  <div className="p-5 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center text-sm text-slate-500">
                    Aucune consultation ni ordonnance enregistrée.
                  </div>
                ) : (
                  <>
                    {clinicalRecord.consultations.filter(() => medicalTab === 'all' || medicalTab === 'consultations').map((consultation) => (
                      <div key={consultation.id} className="rounded-[24px_24px_8px_24px] border border-emerald-100 bg-emerald-50/50 p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-black uppercase text-emerald-800">Consultation</span>
                          <span className="text-xs font-bold text-emerald-600">{new Date(consultation.consultationDate).toLocaleDateString('fr-FR')}</span>
                        </div>
                        <strong className="block text-base font-black text-emerald-950">{consultation.diagnosis}</strong>
                        <p className="text-xs font-bold text-emerald-700">Médecin : {consultation.doctorName || 'Praticien'} · {consultation.treatment || 'Traitement renseigné'}</p>
                        <button type="button" className="text-xs font-black text-emerald-800 hover:underline">Voir le détail complet →</button>
                      </div>
                    ))}
                    {clinicalRecord.prescriptions.filter(() => medicalTab === 'all' || medicalTab === 'prescriptions').map((prescription) => (
                      <div key={prescription.id} className="rounded-[24px_24px_8px_24px] border border-emerald-100 bg-white p-4 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-black uppercase text-emerald-800">Ordonnance</span>
                          <span className="text-xs font-bold text-emerald-600">{prescription.createdAt ? new Date(prescription.createdAt).toLocaleDateString('fr-FR') : 'Date non renseignée'}</span>
                        </div>
                        <strong className="block text-base font-black text-emerald-950">{prescription.medication}</strong>
                        <p className="text-xs font-bold text-emerald-700">{prescription.dosage || 'Posologie non renseignée'} · {prescription.frequency || 'Fréquence non renseignée'}</p>
                        <button type="button" onClick={() => setActiveModal('prescriptions')} className="text-xs font-black text-emerald-800 hover:underline">Voir l’ordonnance →</button>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  speakText(`Dossier médical de ${fullName}, identifiant ${npi}. ${clinicalRecord.consultations.length} consultation(s) et ${clinicalRecord.prescriptions.length} ordonnance(s) enregistrée(s).`);
                }}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
                <span>Écouter le résumé du dossier</span>
              </button>
              <button type="button" onClick={() => window.print()} className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-xs font-black text-emerald-800 hover:bg-emerald-50"><Download className="h-4 w-4" />Télécharger</button>
              <button type="button" onClick={() => { if (navigator.share) navigator.share({ title: 'Mon dossier médical Santé+', text: `Dossier médical de ${fullName}` }); }} className="flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-xs font-black text-emerald-800 hover:bg-emerald-50">Partager</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ---------------------------------------------------- */}
      {/* MODAL 8: RENDEZ-VOUS RAPIDE                          */}
      {/* ---------------------------------------------------- */}
      <AnimatePresence>
        {activeModal === 'appointments' && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-lg font-black text-gray-900">Rendez-vous Programmé</h3>
                <button onClick={() => setActiveModal(null)} className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-5 bg-purple-50 border border-purple-100 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 bg-[#00D26A] text-white font-black text-[10px] rounded-full uppercase">
                    Confirmé
                  </span>
                  <span className="text-xs text-purple-900 font-bold">Demain à 14:00</span>
                </div>
                <div>
                  <h4 className="font-bold text-base text-gray-900">Consultation Cardiologie</h4>
                  <p className="text-xs text-gray-600">Médecin non renseigné • établissement non renseigné</p>
                </div>
                <p className="text-xs text-gray-500 bg-white p-2.5 rounded-xl border border-purple-100">
                  Lieu : Bâtiment A, 1er étage, Salle 104. Munissez-vous de votre QR Code pass.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    speakText("Aucun rendez-vous n’est actuellement programmé pour votre compte.");
                  }}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Écouter le rappel</span>
                </button>
                {onNavigateToAppointments && (
                  <button
                    onClick={() => {
                      setActiveModal(null);
                      onNavigateToAppointments();
                    }}
                    className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-2xl text-xs cursor-pointer"
                  >
                    Gérer
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
