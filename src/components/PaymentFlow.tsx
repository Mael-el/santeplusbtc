import React, { useState, useEffect } from 'react';
import { Hospital, MedicalDocument, Invoice, Patient } from '../types';
import { XOF_TO_SATS } from '../data';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { 
  Lock, Zap, RefreshCw, FileText, CheckCircle2, 
  Wallet, QrCode, Share2, MessageCircle, Copy, Download, 
  ExternalLink, Printer, ShieldCheck, HeartPulse, Sparkles, ArrowLeft 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';

interface PaymentFlowProps {
  hospital: Hospital;
  walletBalance: number;
  setWalletBalance: React.Dispatch<React.SetStateAction<number>>;
  satoshiBalance?: number;
  setSatoshiBalance?: React.Dispatch<React.SetStateAction<number>>;
  patientUser?: Patient | null;
  onBack: () => void;
  onPaymentComplete: (invoice: Invoice) => void;
  userName: string;
  patientPhone?: string;
  customDocuments?: MedicalDocument[];
}

type Step = 'authorize' | 'scanning' | 'retrieving' | 'review-docs' | 'pay-options' | 'success';

export default function PaymentFlow({
  hospital,
  walletBalance,
  setWalletBalance,
  satoshiBalance,
  setSatoshiBalance,
  patientUser,
  onBack,
  onPaymentComplete,
  userName,
  patientPhone = '+229 01 97 88 55 44',
  customDocuments = []
}: PaymentFlowProps) {
  const [step, setStep] = useState<Step>('authorize');
  const [selectedMethod, setSelectedMethod] = useState<'none' | 'lightning' | 'wallet' | 'family-help'>('none');
  const [copiedText, setCopiedText] = useState(false);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [qrCodeToGenerate, setQrCodeToGenerate] = useState('https://sante.gouv.bj');
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);

  // Dynamic Lightning states
  const [invoiceString, setInvoiceString] = useState<string>('');
  const [invoiceId, setInvoiceId] = useState<string>('');
  const [isFetchingInvoice, setIsFetchingInvoice] = useState<boolean>(false);

  // Set patient's name
  const patientName = userName || 'Patient';

  const activeDocs = customDocuments;

  // Computed prices
  const totalXOF = activeDocs.reduce((acc, doc) => acc + doc.priceXOF, 0);
  const totalSats = Math.round(totalXOF * XOF_TO_SATS);

  // Default fallback invoice
  const lightningInvoiceFallback = `lnbc100u1p392066pp5y6m8a6uclm0aqlu7r96paxd0zcrsqm3sff4pghu5r3qpsms9p57qdqg2fhk6mmpwq5kget8wf5k2cmzv9hkutssw3skget8v4cxjumn94sk2uewdqh8gmpwd3jxc6tvd3hxw3scqpvqyjw5qcqpxrzjqw72q3ksla762hsp48qaswep7mqcxw6mppv6mpwpwqf7mpws9p4xpwpvq5qshxztf9f8gskqfq9gqkcxsqypqxpqxzszqxpqw7p9sk7tve9ekymv9cxqpxrzjqw72q3ksla762hsp48qaswep7mqcxw6mppv6mpwpwqf7mpws9p4xpwpvq5qshxztf9f8gskqfq9gqkcxsqypqxpqxzszqxpqw7p9`;

  // Fetch dynamic Breez lightning invoice on selection
  useEffect(() => {
    if (selectedMethod === 'lightning' || selectedMethod === 'family-help') {
      setIsFetchingInvoice(true);
      fetch('/api/payments/create-lightning-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountXOF: totalXOF, description: `Soins Sante+ - ${hospital.name}` })
      })
      .then(res => {
        if (!res.ok) throw new Error("Status non-OK");
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Pas de JSON");
        }
        return res.json();
      })
      .then(data => {
        setInvoiceString(data.invoice || lightningInvoiceFallback);
        setInvoiceId(data.invoiceId);
        setIsFetchingInvoice(false);
      })
      .catch(err => {
        console.warn("Notice: Using secure lightning fallback for Breez invoice creation.", err);
        setInvoiceString(lightningInvoiceFallback);
        setIsFetchingInvoice(false);
      });
    }
  }, [selectedMethod]);

  // Poll server for Lightning invoice settlement (Real-time Breez webhook representation)
  useEffect(() => {
    if (!invoiceId || step === 'success' || isSimulatingPayment) return;

    const interval = setInterval(() => {
      fetch(`/api/payments/verify-lightning-invoice?invoiceId=${invoiceId}`)
      .then(res => {
        if (!res.ok) throw new Error("Status non-OK");
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Pas de JSON");
        }
        return res.json();
      })
      .then(data => {
        if (data.isPaid) {
          const newInvoice: Invoice = {
            id: data.invoiceId || `FACT-${Math.floor(100000 + Math.random() * 900000)}`,
            patientName,
            patientPhone,
            hospitalName: hospital.name,
            hospitalAddress: hospital.address,
            date: new Date().toLocaleDateString('fr-FR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            items: activeDocs.flatMap(doc => doc.items),
            totalXOF,
            totalSats,
            paymentMethod: selectedMethod === 'family-help' ? 'FamilyHelp' : 'Lightning',
            txHash: data.txHash || '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
            isPaid: true,
            doctorName: getDoctorName(hospital.id),
          };
          setInvoice(newInvoice);
          setStep('success');
          onPaymentComplete(newInvoice);
        }
      })
      .catch(err => console.warn("Polling error:", err));
    }, 2500);

    return () => clearInterval(interval);
  }, [invoiceId, step, selectedMethod, isSimulatingPayment]);

  // Start biometric simulation
  const handleStartScan = () => {
    setStep('scanning');
    setTimeout(() => {
      setStep('retrieving');
      // Simulate hospital dropping files
      setTimeout(() => {
        setStep('review-docs');
      }, 2500);
    }, 2000);
  };

  const getDoctorName = (hospitalId: string) => {
    if (hospitalId === 'chd-atlantique') return 'Dr. Jean Sossou';
    if (hospitalId === 'hz-calavi') return 'Dr. Sonia Gbaguidi';
    if (hospitalId === 'clinique-union') return 'Dr. Albert Devigan';
    return 'Dr. Jean Sossou';
  };

  // Perform self wallet payment
  const handlePayWithWallet = () => {
    if (walletBalance < totalXOF) return;
    
    setIsSimulatingPayment(true);
    setTimeout(() => {
      setWalletBalance(prev => prev - totalXOF);
      const newInvoice: Invoice = {
        id: `FACT-${Math.floor(100000 + Math.random() * 900000)}`,
        patientName,
        patientPhone,
        hospitalName: hospital.name,
        hospitalAddress: hospital.address,
        date: new Date().toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        items: activeDocs.flatMap(doc => doc.items),
        totalXOF,
        totalSats,
        paymentMethod: 'Wallet',
        txHash: '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        isPaid: true,
        doctorName: getDoctorName(hospital.id),
      };
      setInvoice(newInvoice);
      setStep('success');
      setIsSimulatingPayment(false);
      onPaymentComplete(newInvoice);
    }, 1800);
  };

  // Perform simulation of lightning or family payment
  const handleSimulateLightningPayment = (method: 'Lightning' | 'FamilyHelp') => {
    setIsSimulatingPayment(true);
    setTimeout(() => {
      const newInvoice: Invoice = {
        id: `FACT-${Math.floor(100000 + Math.random() * 900000)}`,
        patientName,
        patientPhone,
        hospitalName: hospital.name,
        hospitalAddress: hospital.address,
        date: new Date().toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        items: activeDocs.flatMap(doc => doc.items),
        totalXOF,
        totalSats,
        paymentMethod: method,
        txHash: '0x' + Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        isPaid: true,
        doctorName: getDoctorName(hospital.id),
      };
      setInvoice(newInvoice);
      setStep('success');
      setIsSimulatingPayment(false);
      onPaymentComplete(newInvoice);
    }, 2000);
  };

  const getUnpaidInvoiceObject = (): Invoice => {
    return {
      id: `DEVIS-${Math.floor(100000 + Math.random() * 900000)}`,
      patientName,
      patientPhone,
      hospitalName: hospital.name,
      hospitalAddress: hospital.address,
      date: new Date().toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      items: activeDocs.flatMap(doc => doc.items),
      totalXOF,
      totalSats,
      paymentMethod: 'Lightning',
      txHash: 'N/A (DEVIS DE SOINS NON ACQUITTÉ)',
      isPaid: false,
      doctorName: getDoctorName(hospital.id)
    };
  };

  const handlePayWithLightningSats = () => {
    if (satoshiBalance === undefined || setSatoshiBalance === undefined) {
      alert("Identifiez-vous en tant que patient pour débiter vos satoshis réels.");
      return;
    }
    if (satoshiBalance < totalSats) {
      alert(`Solde de Satoshis insuffisant dans votre portefeuille Lightning (${(satoshiBalance ?? 0).toLocaleString()} Sats dispos vs ${(totalSats ?? 0).toLocaleString()} Sats requis).`);
      return;
    }

    setIsSimulatingPayment(true);
    
    // Create temporary unpaid invoice in local memory to pass to API
    fetch(`/api/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientName,
        patientPhone,
        hospitalName: hospital.name,
        hospitalAddress: hospital.address,
        items: activeDocs.flatMap(doc => doc.items),
        totalXOF,
        paymentMethod: 'Lightning',
        isPaid: false,
        doctorName: getDoctorName(hospital.id)
      })
    })
    .then(res => res.json())
    .then(tempInvoice => {
      // Pay invoice via lightning API
      return fetch(`/api/invoices/${tempInvoice.id}/pay-lightning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: patientUser?.email || 'bienvenuesegnon@gmail.com' })
      });
    })
    .then(async res => {
      const contentType = res.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");
      if (!res.ok) {
        const errorMsg = isJson ? (await res.json()).error : await res.text();
        throw new Error(errorMsg || "Erreur de règlement Lightning");
      }
      if (!isJson) {
        throw new Error("Réponse du serveur non valide");
      }
      return res.json();
    })
    .then(payload => {
      // Success! Update satoshi balance
      setSatoshiBalance(prev => prev - totalSats);
      setInvoice(payload.invoice);
      setStep('success');
      setIsSimulatingPayment(false);
      onPaymentComplete(payload.invoice);
    })
    .catch(err => {
      console.error(err);
      alert(err.message || "Une erreur est survenue lors du paiement Lightning.");
      setIsSimulatingPayment(false);
    });
  };

  const downloadInvoicePDF = (inv: Invoice, isPaid: boolean = true) => {
    const qrOfflineText = `[SANTÉ+ BÉNIN - DOCUMENT ${isPaid ? 'PAYÉ' : 'NON PAYÉ'}]
------------------------------------
Type: ${isPaid ? 'Recu Officiel' : 'Facture Pro-Forma - Devis'}
Réf: ${inv.id}
Patient: ${inv.patientName}
Établissement: ${inv.hospitalName}
Montant total: ${(inv.totalXOF ?? 0).toLocaleString('fr-FR')} XOF
Date: ${inv.date}
Statut: ${isPaid ? 'PAYÉ & CERTIFIÉ' : 'EN ATTENTE DE PAIEMENT (SATS ou WALLET)'}`;

    setQrCodeToGenerate(qrOfflineText);

    setTimeout(() => {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const primaryColor = isPaid ? [5, 150, 105] : [230, 120, 0];
      const textColor = [28, 28, 30];
      const lightGray = [120, 120, 128];

      // Header Sante+ Benin
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('SANTÉ+ BÉNIN', 20, 25);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.text('RÉSEAU MÉDICAL NATIONAL ET SÉCURISÉ', 20, 30);

      // Line separator
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(1);
      doc.line(20, 35, 190, 35);

      // Doc Type
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(isPaid ? 'REÇU DE TRANSACTION MÉDICALE' : 'DEVIS DE SOINS - FACTURE PRO-FORMA', 20, 45);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(`${isPaid ? 'Réf Facture' : 'Réf Devis'} : ${inv.id}`, 20, 52);
      doc.text(`Date d'émission : ${inv.date}`, 20, 57);

      // DRAW VISIBLE OFFICIAL STAMP
      if (isPaid) {
        doc.setDrawColor(239, 68, 68);
        doc.setLineWidth(0.6);
        doc.rect(130, 42, 58, 16);
        doc.setTextColor(239, 68, 68);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('MINISTÈRE DE LA SÉCURITÉ BÉNIN', 131, 47);
        doc.setFontSize(10);
        doc.text('PAYÉ & CERTIFIÉ', 138, 53);
      } else {
        doc.setDrawColor(230, 120, 0);
        doc.setLineWidth(0.6);
        doc.rect(130, 42, 58, 16);
        doc.setTextColor(230, 120, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('MINISTÈRE DE LA SÉCURITÉ BÉNIN', 131, 47);
        doc.setFontSize(9);
        doc.text('DEVIS NON PAYÉ', 137, 53);
      }

      // Reset text details
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);

      // Hospital Info
      doc.text('ÉTABLISSEMENT ÉMETTEUR', 20, 68);
      doc.setFont('helvetica', 'normal');
      doc.text(`${inv.hospitalName}`, 20, 73);
      doc.setFontSize(9);
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.text(`${inv.hospitalAddress}`, 20, 77);

      doc.setFontSize(9.5);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFont('helvetica', 'bold');
      doc.text('MÉDECIN PRATICIEN CONCERNÉ', 20, 85);
      doc.setFont('helvetica', 'normal');
      doc.text(`${inv.doctorName || 'Dr. Jean Sossou'}`, 20, 90);

      // Additional doctor details as requested
      doc.setFontSize(8.5);
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.text(`Tél : ${inv.doctorPhone || "+229 01 95 40 12 34"}`, 20, 94);
      doc.text(`Spécialité : Généraliste Agréé (N° Ordre: 4028-BJ)`, 20, 98);

      // Patient Info (Pushed slightly to the right to X = 130)
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.setFontSize(9.5);
      doc.text('CITOYEN PATIENT', 130, 68);
      doc.setFont('helvetica', 'normal');
      doc.text(`${inv.patientName}`, 130, 73);
      doc.text('Bénin - Citoyen Identifié', 130, 77);
      doc.text(`Tél : ${inv.patientPhone || "+229 01 97 88 55 44"}`, 130, 81);

      // Line separator pushed down to 103 to prevent overlap
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(20, 103, 190, 103);

      // Table header
      doc.setFont('helvetica', 'bold');
      doc.text('Désignation des prestations', 22, 110);
      doc.text('Montant (XOF)', 150, 110);

      doc.line(20, 113, 190, 113);

      // Items starting at y = 120
      let y = 120;
      inv.items.forEach((item, index) => {
        doc.setFont('helvetica', 'normal');
        doc.text(`${index + 1}. ${item.name}`, 22, y);
        doc.setFont('helvetica', 'bold');
        doc.text(`${(item.priceXOF ?? 0).toLocaleString('fr-FR')} XOF`, 150, y);
        y += 8;
      });

      doc.line(20, y, 190, y);
      y += 8;

      // Total
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(isPaid ? 'TOTAL GÉNÉRAL ACQUITTÉ' : 'TOTAL DU DEVIS À RÉGLER', 22, y);
      doc.text(`${(inv.totalXOF ?? 0).toLocaleString('fr-FR')} XOF`, 150, y);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.text(`(~ ${(inv.totalSats ?? 0).toLocaleString('fr-FR')} Satoshis sur réseau Lightning)`, 22, y + 5);

      y += 18;

      // Blockchain Signature block
      doc.setDrawColor(240, 240, 245);
      doc.setFillColor(248, 249, 250);
      doc.rect(20, y, 170, 25, 'F');

      const canvas = document.getElementById('flow-pdf-qr-canvas') as HTMLCanvasElement;
      if (canvas) {
        try {
          const qrDataUrl = canvas.toDataURL('image/png');
          doc.addImage(qrDataUrl, 'PNG', 164, y + 2.5, 20, 20);
        } catch (err) {
          console.error("Error generating QR code in flow", err);
        }
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('DOCUMENT SANTE+ SÉCURISÉ', 24, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.text(`Statut : ${isPaid ? 'Facture Acquittée & Validée' : 'Devis Pro-Forma en Attente'}`, 24, y + 12);
      doc.text('Paiement enregistré dans votre espace santé', 24, y + 17);

      // Footer seal
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(230, 120, 0);
      doc.text('MINISTÈRE DE LA SANTÉ DU BÉNIN - AGRÉÉ ET CERTIFIÉ CONFORME', 20, 270);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.text("Document généré numériquement de manière sécurisée. Ne nécessite pas de signature physique.", 20, 274);

      doc.save(`${isPaid ? 'facture' : 'devis'}-sante-${inv.id}.pdf`);
    }, 150);
  };

  const copyInvoiceText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Pre-filled text for help sharing
  const shareMessage = `Salut ! Je suis actuellement à l'établissement "${hospital.name}" à Abomey-Calavi pour des soins de santé. Peux-tu m'aider à régler ma facture médicale de ${(totalXOF ?? 0).toLocaleString('fr-FR')} XOF (${(totalSats ?? 0).toLocaleString()} Sats) via ce lien de paiement direct sécurisé ? ${window.location.origin}/pay?bill=${Math.floor(10000 + Math.random() * 90000)}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;

  return (
    <div id="payment-flow-component" className="max-w-2xl mx-auto bg-[#F2F2F7] p-2 md:p-6 rounded-3xl min-h-[600px] flex flex-col justify-center">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs p-6 md:p-8 flex-1 flex flex-col">
        
        {/* Header (Back option) */}
        {step !== 'success' && (
          <div className="flex items-center gap-3 mb-6">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-all cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-bold font-sans text-[#1C1C1E]">Règlement de soins</h2>
              <p className="text-xs text-gray-400 font-sans">{hospital.name}</p>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          
          {/* STEP 1: AUTHORIZE DOSSIER (Initial State) */}
          {step === 'authorize' && (
            <motion.div
              key="authorize"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-4"
            >
              <div className="w-20 h-20 rounded-3xl bg-[#059669]/10 flex items-center justify-center border border-[#059669]/20 shadow-xs text-[#059669]">
                <Zap className="w-10 h-10 text-[#FFB300]" />
              </div>

              <div className="space-y-2 max-w-md">
                <h3 className="text-xl font-sans font-extrabold text-[#1C1C1E] tracking-tight">Autorisation de Dossier Médical</h3>
                <p className="text-sm text-gray-500 font-sans leading-relaxed">
                  Afin de permettre à l'établissement de déposer vos actes de soins (ordonnances, analyses) de manière sécurisée, vous devez autoriser l'accès à votre dossier.
                </p>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-[11px] text-amber-800 text-left space-y-1 mt-2">
                  <span className="font-bold block">Autorisation sécurisée :</span>
                  <p>Aucune reconnaissance faciale ou d'empreinte digitale n'est requise. Vous allez signer numériquement à l'aide d'une clé privée liée à votre identité Lightning Network (LN Sign).</p>
                </div>
              </div>

              {/* User badge */}
              <div className="px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-2xl flex items-center gap-2 text-xs text-gray-600 font-sans font-medium">
                <span className="w-2 h-2 rounded-full bg-[#00D26A]"></span>
                Patient connecté : {patientName}
              </div>

              {/* Trigger Button */}
              <button
                onClick={handleStartScan}
                className="w-full py-4 px-6 bg-[#00D26A] hover:bg-[#00D26A]/95 text-white font-sans font-extrabold rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Zap className="w-5 h-5 fill-white text-white animate-pulse" />
                <span>Signer l'autorisation via Lightning Network (LN)</span>
              </button>
            </motion.div>
          )}

          {/* STEP 1.5: LIGHTNING NETWORK SIGNING ANIMATION */}
          {step === 'scanning' && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-8 py-10"
            >
              {/* Lightning Network Signature Effect */}
              <div className="relative w-32 h-32 flex items-center justify-center">
                {/* Circular pulse rings */}
                <span className="absolute inset-0 rounded-full border-2 border-[#00D26A]/30 animate-ping"></span>
                <span className="absolute inset-4 rounded-full border border-[#00D26A]/45 animate-pulse"></span>
                
                {/* Rotating ring */}
                <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#00D26A]/60 animate-spin" style={{ animationDuration: '5s' }}></div>

                <div className="w-24 h-24 rounded-full bg-[#00D26A]/10 border border-[#00D26A]/25 flex items-center justify-center text-[#00D26A]">
                  <Zap className="w-12 h-12 fill-[#00D26A]" />
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-md font-sans font-bold text-[#1C1C1E]">Validation sécurisée en cours...</p>
                <p className="text-xs text-gray-400 font-sans">Sécurisation et inscription de l'autorisation d'accès sur le protocole LN</p>
              </div>
            </motion.div>
          )}

          {/* STEP 2: RETRIEVING DOCUMENTS */}
          {step === 'retrieving' && (
            <motion.div
              key="retrieving"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-6 py-10"
            >
              <div className="w-14 h-14 rounded-full bg-slate-50 border border-gray-100 flex items-center justify-center">
                <RefreshCw className="w-6 h-6 text-[#059669] animate-spin" />
              </div>

              <div className="space-y-2">
                <p className="text-md font-sans font-bold text-[#1C1C1E]">Récupération autorisée</p>
                <p className="text-xs text-gray-400 font-sans max-w-xs mx-auto">
                  L'hôpital dépose actuellement vos analyses prescrites, ordonnances et devis sur votre mobile...
                </p>
              </div>
            </motion.div>
          )}

          {/* STEP 3: REVIEW DOCUMENTS DEPOSITED */}
          {step === 'review-docs' && (
            <motion.div
              key="review-docs"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 flex flex-col space-y-6"
            >
              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#00D26A]/10 flex items-center justify-center text-[#00D26A] flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="text-xs font-sans text-emerald-800 leading-tight">
                  <strong>{activeDocs.length} Document(s) reçu(s) :</strong> Autorisation validée. L'établissement a déposé vos frais médicaux à régler.
                </div>
              </div>

              {/* Itemized Document Cards */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[280px] pr-1">
                {activeDocs.map((doc) => (
                  <div key={doc.id} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-2xs space-y-3 hover:border-gray-200 transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-sans text-gray-800 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-gray-400" />
                        {doc.title}
                      </span>
                      <span className="text-xs font-mono font-bold text-gray-900 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                        {(doc.priceXOF ?? 0).toLocaleString('fr-FR')} XOF
                      </span>
                    </div>

                    <div className="pl-6 space-y-1 border-l border-gray-100">
                      {doc.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs text-gray-500 font-sans">
                          <span>{item.name} {item.quantity ? `(x${item.quantity})` : ''}</span>
                          <span>{(item.priceXOF ?? 0).toLocaleString('fr-FR')} XOF</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals Summary */}
              <div className="p-5 bg-gradient-to-br from-[#007048] to-[#00a86b] text-white rounded-2xl flex items-center justify-between shadow-md border border-[#c5ebd7]/30">
                <div>
                  <p className="text-[10px] text-emerald-100 uppercase tracking-wider font-bold font-sans">Total Général à payer</p>
                  <p className="text-2xl font-black font-sans mt-0.5 text-white">{(totalXOF ?? 0).toLocaleString('fr-FR')} XOF</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold font-sans">Contrevaleur Lightning</p>
                  <p className="text-md font-mono font-bold text-amber-400 mt-0.5">{(totalSats ?? 0).toLocaleString()} Sats</p>
                </div>
              </div>

              {/* Devis / Pro-forma download button for unpaid invoice as requested by user */}
              <button
                type="button"
                onClick={() => downloadInvoicePDF(getUnpaidInvoiceObject(), false)}
                className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 font-bold font-sans text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-amber-500/20"
              >
                <Download className="w-4 h-4" />
                Télécharger la Facture Pro-Forma (Devis de Soins non payé)
              </button>

              {/* Proceed Button */}
              <button
                onClick={() => setStep('pay-options')}
                className="w-full py-4 bg-[#059669] hover:bg-[#059669]/95 text-white font-bold font-sans text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Choisir le mode de paiement
              </button>
            </motion.div>
          )}

          {/* STEP 4: CHOOSE PAYMENT OPTIONS & HELP SHARING */}
          {step === 'pay-options' && (
            <motion.div
              key="pay-options"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex-1 flex flex-col space-y-6"
            >
              {/* Cost recall */}
              <div className="text-center pb-2">
                <span className="text-xs text-gray-400 font-sans uppercase tracking-wider font-medium">Facture en cours de règlement</span>
                <div className="flex items-baseline justify-center gap-2 mt-1">
                  <span className="text-3xl font-extrabold font-sans text-[#1C1C1E]">{(totalXOF ?? 0).toLocaleString('fr-FR')} XOF</span>
                  <span className="text-sm font-mono text-gray-400">({(totalSats ?? 0).toLocaleString()} Sats)</span>
                </div>
              </div>

              {/* Grid of the 3 specified choices */}
              <div className="space-y-3">
                {/* CHOICE B: Pay myself via Wallet Santé+ */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('wallet')}
                  className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-4 ${
                    selectedMethod === 'wallet'
                      ? 'border-[#00D26A] bg-[#00D26A]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${selectedMethod === 'wallet' ? 'bg-[#00D26A] text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                       <h4 className="text-sm font-bold font-sans text-gray-800">Payer avec mon Wallet Santé+</h4>
                      <span className="text-xs font-bold font-sans text-[#00D26A]">{(walletBalance ?? 0).toLocaleString('fr-FR')} XOF dispo</span>
                    </div>
                    <p className="text-xs text-gray-500 font-sans mt-0.5">Règlement instantané sécurisé par votre solde prépayé</p>
                  </div>
                </button>

                {/* CHOICE A: Pay myself via Lightning (QR Code) */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('lightning')}
                  className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-4 ${
                    selectedMethod === 'lightning'
                      ? 'border-[#059669] bg-[#059669]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${selectedMethod === 'lightning' ? 'bg-[#059669] text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold font-sans text-gray-800">Payer moi-même en Lightning (Sats)</h4>
                    <p className="text-xs text-gray-500 font-sans mt-0.5">Génère un QR Code pour régler votre facture</p>
                  </div>
                </button>

                {/* CHOICE C: Share for help (WhatsApp / QR) */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('family-help')}
                  className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-4 ${
                    selectedMethod === 'family-help'
                      ? 'border-[#FF8A00] bg-amber-50/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${selectedMethod === 'family-help' ? 'bg-[#FF8A00] text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold font-sans text-gray-800">Demander de l'aide à un proche (WhatsApp & QR)</h4>
                    <p className="text-xs text-gray-500 font-sans mt-0.5">Génère un lien de paiement WhatsApp et un QR Code visible pour vos proches</p>
                  </div>
                </button>
              </div>

              {/* SUB-SECTIONS ACCORDING TO CHOSEN METHOD */}
              <div className="border-t border-gray-100 pt-5">
                {isSimulatingPayment ? (
                  <div className="py-8 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-[#059669] animate-spin mx-auto" />
                    <p className="text-sm font-semibold font-sans text-gray-700">Traitement de la transaction...</p>
                    <p className="text-xs text-gray-400 font-sans">Ne quittez pas l'application</p>
                  </div>
                ) : (
                  <>
                    {/* Method: Wallet */}
                    {selectedMethod === 'wallet' && (
                      <div className="space-y-4">
                        {walletBalance >= totalXOF ? (
                          <button
                            onClick={handlePayWithWallet}
                            className="w-full py-3.5 bg-[#00D26A] hover:bg-[#00D26A]/95 text-white font-bold font-sans text-sm rounded-2xl shadow-sm transition-all text-center cursor-pointer"
                          >
                            Confirmer et Débiter {(totalXOF ?? 0).toLocaleString('fr-FR')} XOF
                          </button>
                        ) : (
                          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-xs font-sans font-medium text-center">
                            Solde insuffisant dans votre Wallet Santé+ ({(walletBalance ?? 0).toLocaleString('fr-FR')} XOF restant). Veuillez choisir un autre mode de paiement ou recharger votre compte.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Method: Lightning */}
                    {selectedMethod === 'lightning' && (
                      <div className="bg-slate-50 p-4 rounded-2xl border border-gray-100 space-y-4 text-center">
                        {isFetchingInvoice ? (
                          <div className="py-6 flex flex-col items-center justify-center gap-2">
                            <RefreshCw className="w-6 h-6 text-[#059669] animate-spin" />
                            <span className="text-xs font-bold text-gray-500 font-sans">Génération de la facture sécurisée Breez API...</span>
                          </div>
                        ) : (
                          <>
                            <div className="bg-white p-3.5 rounded-xl inline-block shadow-2xs border border-gray-100">
                              {/* QR Code generating the lightning invoice */}
                              <QRCodeSVG value={invoiceString || lightningInvoiceFallback} size={150} level="M" />
                            </div>
                            <p className="text-xs font-bold text-[#1C1C1E] font-sans">Scannez ce QR Code avec votre portefeuille Lightning (ex: Phoenix, Muun, Breez)</p>
                            
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => copyInvoiceText(invoiceString || lightningInvoiceFallback)}
                                className="px-3 py-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-sans text-gray-700 font-semibold flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                {copiedText ? 'Copié !' : 'Copier l\'Invoice'}
                              </button>
                            </div>

                            {satoshiBalance !== undefined && (
                              <div className="pt-3 border-t border-gray-200/50 mt-3 text-center">
                                <p className="text-[10px] text-gray-500 font-sans mb-1.5">
                                  Portefeuille Santé+ Lightning connecté : <strong className="text-amber-600 font-mono">{(satoshiBalance ?? 0).toLocaleString('fr-FR')} Sats disponibles</strong>
                                </p>
                                <button
                                  type="button"
                                  onClick={handlePayWithLightningSats}
                                  className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-sans font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Zap className="w-4 h-4 fill-white" />
                                  Débiter mes Satoshis Réels (-{(totalSats ?? 0).toLocaleString('fr-FR')} Sats)
                                </button>
                              </div>
                            )}

                            <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-emerald-700 bg-emerald-50/80 py-2.5 px-4 rounded-xl animate-pulse mt-3 border border-emerald-100">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Réseau Lightning actif : En attente du règlement...</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Method: Family Help (WhatsApp Link + QR Code BOTH) */}
                    {selectedMethod === 'family-help' && (
                      <div className="bg-slate-50 p-5 rounded-2xl border border-gray-100 space-y-5">
                        <div className="text-center space-y-2">
                          <h4 className="text-xs font-bold uppercase text-amber-800 tracking-wider font-sans">Aide Familiale Santé+ active</h4>
                          <p className="text-xs text-gray-500 font-sans">
                            Conformément à la règle d'or, pas de cagnotte globale compliquée. Votre proche effectue un paiement direct pour cette facture spécifique en sats, libérant ainsi vos documents.
                          </p>
                        </div>

                        {isFetchingInvoice ? (
                          <div className="py-6 flex flex-col items-center justify-center gap-2">
                            <RefreshCw className="w-6 h-6 text-[#FF8A00] animate-spin" />
                            <span className="text-xs font-bold text-gray-500 font-sans">Génération de la facture sécurisée Breez API...</span>
                          </div>
                        ) : (
                          <>
                            {/* Dual Interface layout as requested: BOTH WA link + Visible QR */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                              {/* Part 1: QR Code visible for immediate scanning if family member is close */}
                              <div className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col items-center text-center space-y-2">
                                <QRCodeSVG value={invoiceString || lightningInvoiceFallback} size={120} level="M" />
                                <span className="text-[10px] font-sans text-gray-400 font-semibold uppercase tracking-wider">QR Code de Facturation</span>
                                <span className="text-[11px] font-sans text-gray-600 leading-tight">À scanner sur place pour payer en Sats</span>
                              </div>

                              {/* Part 2: WhatsApp Link Sharing */}
                              <div className="space-y-3">
                                <div className="p-3 bg-white border border-gray-100 rounded-xl">
                                  <p className="text-[10px] text-gray-400 uppercase font-sans font-bold">Message généré :</p>
                                  <p className="text-[11px] text-gray-600 font-sans line-clamp-3 mt-1 italic">
                                    "{shareMessage}"
                                  </p>
                                </div>

                                <a
                                  href={whatsappUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-full py-2.5 px-3 bg-[#00D26A] hover:bg-[#00D26A]/90 text-white font-bold rounded-xl text-xs font-sans flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer text-center"
                                >
                                  <MessageCircle className="w-4 h-4 fill-current" />
                                  Partager par WhatsApp
                                </a>

                                <button
                                  onClick={() => copyInvoiceText(shareMessage)}
                                  className="w-full py-2 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-sans text-gray-700 font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5 mr-1" />
                                  {copiedText ? 'Message copié !' : 'Copier le message et lien'}
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-amber-700 bg-amber-50/80 py-2.5 px-4 rounded-xl animate-pulse border border-amber-200">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>En attente du règlement par votre proche...</span>
                            </div>

                            {satoshiBalance !== undefined && (
                              <div className="pt-3 border-t border-gray-200/50 mt-3 text-center">
                                <p className="text-[10px] text-gray-500 font-sans mb-1.5 font-semibold">
                                  Ou réglez instantanément avec vos Satoshis connectés : <strong className="text-amber-600 font-mono">{(satoshiBalance ?? 0).toLocaleString('fr-FR')} Sats</strong>
                                </p>
                                <button
                                  type="button"
                                  onClick={handlePayWithLightningSats}
                                  className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-sans font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Zap className="w-4 h-4 fill-white" />
                                  Payer moi-même en Sats (-{(totalSats ?? 0).toLocaleString('fr-FR')} Sats)
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Placeholder when nothing is selected */}
                    {selectedMethod === 'none' && (
                      <p className="text-xs text-gray-400 text-center font-sans py-4">
                        Sélectionnez une option de paiement ci-dessus pour continuer.
                      </p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 5: SUCCESS & PDF INVOICE AVAILABLE */}
          {step === 'success' && invoice && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col space-y-6"
            >
              {/* Success Banner */}
              <div className="text-center py-4 space-y-3">
                <div className="w-14 h-14 bg-[#00D26A]/10 border border-[#00D26A]/20 rounded-full flex items-center justify-center text-[#00D26A] mx-auto shadow-2xs">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black font-sans text-gray-900">Paiement Validé</h3>
                  <p className="text-xs text-gray-400 font-sans">
                    Réceptionné avec succès par {hospital.name}
                  </p>
                </div>
              </div>

              {/* PDF Invoice View Container */}
              <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-xs text-left relative overflow-hidden space-y-4">
                {/* PDF Paper Header Decor */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#059669]"></div>
                
                {/* Official red stamp badge overlay */}
                <div className="absolute right-6 top-16 border-2 border-dashed border-rose-500 text-rose-500 font-sans font-black text-[9px] tracking-widest px-3 py-1.5 rounded-lg uppercase -rotate-12 pointer-events-none select-none flex flex-col items-center bg-rose-50/40 shadow-xs">
                  <span className="text-[7px] font-sans">MINISTÈRE DE LA SANTÉ</span>
                  <span className="text-sm font-bold font-sans">PAYÉ</span>
                  <span className="text-[6px] font-sans">{invoice.date}</span>
                </div>

                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-md font-sans font-extrabold text-gray-800">SANTÉ+</h4>
                    <p className="text-[10px] text-gray-400 font-sans uppercase tracking-wider font-bold">Plateforme de soins Bénin</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-[#00D26A] text-[11px] font-sans font-bold rounded-lg uppercase tracking-wider">
                      Facture Payée
                    </span>
                    <p className="text-[10px] text-gray-400 font-sans mt-1">N° {invoice.id}</p>
                  </div>
                </div>

                <hr className="border-gray-100" />

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                  <div>
                    <span className="text-gray-400 font-sans block">Patient</span>
                    <strong className="text-gray-800 font-sans font-bold block mt-0.5">{invoice.patientName}</strong>
                    <span className="text-gray-500 font-mono block mt-0.5">{invoice.patientPhone || "+229 01 97 88 55 44"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-sans block">Établissement émetteur</span>
                    <strong className="text-gray-800 font-sans font-bold block mt-0.5">{invoice.hospitalName}</strong>
                    <span className="text-gray-500 font-sans block mt-0.5">{invoice.hospitalAddress}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-sans">
                  <div>
                    <span className="text-gray-400 font-sans block">Date de paiement</span>
                    <span className="text-gray-700 font-sans block mt-0.5">{invoice.date}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 font-sans block">Méthode utilisée</span>
                    <span className="text-gray-700 font-sans block mt-0.5 font-semibold flex items-center gap-1">
                      {invoice.paymentMethod === 'Wallet' && <><Wallet className="w-3.5 h-3.5 text-[#00D26A]" /> Wallet Santé+</>}
                      {invoice.paymentMethod === 'Lightning' && <><QrCode className="w-3.5 h-3.5 text-[#059669]" /> Lightning Direct (Sats)</>}
                      {invoice.paymentMethod === 'FamilyHelp' && <><Share2 className="w-3.5 h-3.5 text-[#FF8A00]" /> Aide Familiale (Sats)</>}
                    </span>
                  </div>
                </div>

                {/* Bill Line Items */}
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs font-sans space-y-1.5">
                  <div className="flex justify-between text-gray-400 font-bold border-b border-gray-200/60 pb-1.5 uppercase text-[9px] tracking-wider">
                    <span>Désignation de l'acte</span>
                    <span>Montant</span>
                  </div>
                  {invoice.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-gray-700">
                      <span>{it.name}</span>
                      <span className="font-semibold">{(it.priceXOF ?? 0).toLocaleString('fr-FR')} XOF</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-gray-900 border-t border-gray-200/60 pt-1.5 font-bold mt-1 text-sm">
                    <span className="font-sans">Total Acquitté</span>
                    <span className="font-sans text-gray-950">{(invoice.totalXOF ?? 0).toLocaleString('fr-FR')} XOF</span>
                  </div>
                  <div className="text-right text-[10px] text-gray-400 font-sans font-medium">
                    (Équivalent réglé de {(invoice.totalSats ?? 0).toLocaleString()} Satoshis)
                  </div>
                </div>

                {/* Footer seal */}
                <div className="flex justify-between items-center text-[10px] font-sans text-gray-400 border-t border-gray-100 pt-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-1 rounded-lg border border-gray-100 shadow-3xs">
                      <QRCodeSVG 
                        value={`[SANTÉ+ BÉNIN - DOCUMENT PAYÉ ET VERIFIÉ SANS CONNEXION]
------------------------------------
Réf Facture: ${invoice.id}
Patient: ${invoice.patientName}
Établissement: ${invoice.hospitalName}
Montant total: ${(invoice.totalXOF ?? 0).toLocaleString('fr-FR')} XOF
Date: ${invoice.date}
Méthode: ${invoice.paymentMethod === 'Wallet' ? 'Portefeuille Prépayé' : 'Réseau Lightning'}
Statut: CERTIFIÉ PAYÉ (OFFLINE STAMP - BLOCKCHAIN BÉNIN)`}
                        size={48}
                        level="M"
                      />
                    </div>
                    <div>
                      <span className="block font-semibold text-gray-700">Référence transaction</span>
                      <span className="font-mono text-[9px] block truncate max-w-[150px] mt-0.5">{invoice.txHash}</span>
                      <span className="text-[9px] text-[#059669] font-semibold mt-0.5 block">Scanner pour vérification offline</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 rounded-lg text-[#FF8A00] font-bold border border-amber-200">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Ministère de la Santé agréé
                  </div>
                </div>
              </div>

              {/* Action Buttons for PDF invoice */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => downloadInvoicePDF(invoice, true)}
                  className="py-3 px-4 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold font-sans text-xs rounded-2xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  Télécharger Facture (PDF)
                </button>
                <button
                  onClick={onBack}
                  className="py-3 px-4 bg-[#059669] hover:bg-[#059669]/95 text-white font-bold font-sans text-xs rounded-2xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Fermer & Retour
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
      
      {/* Hidden Canvas for QR Code embedding in jsPDF */}
      <div className="hidden">
        <QRCodeCanvas
          id="flow-pdf-qr-canvas"
          value={qrCodeToGenerate}
          size={150}
          level="H"
        />
      </div>
    </div>
  );
}
