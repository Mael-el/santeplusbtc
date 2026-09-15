import React, { useState } from 'react';
import { HospitalUser, Hospital, Appointment, Invoice, MedicalDocument, AccessRequest } from '../types';
import { HOSPITALS } from '../data';
import SanteLogo from './SanteLogo';
import {
  Mic, User, Check, Sparkles, ShieldCheck, Bell,
  BarChart2, FileText, ArrowRight, Clock, PlusCircle,
  Search, CheckCircle2, AlertCircle, X, Download, Edit3, Volume2,
  QrCode, CreditCard, Camera, Heart, HelpCircle, Headphones, Send, Save, PhoneCall
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HospitalDashboardProps {
  user: HospitalUser;
  appointments: Appointment[];
  invoices: Invoice[];
  onEmitDocument: (doc: MedicalDocument) => void;
  onLogout: () => void;
  onConfirmAppointment: (id: string) => void;
  accessRequests: AccessRequest[];
  onAddAccessRequest: (npi: string) => void;
  hospitals?: Hospital[];
  onVerifyHospital?: (id: string) => void;
  onAddHospital?: (newHosp: any) => Promise<Hospital>;
  customDocuments?: MedicalDocument[];
  onUpdateDocument?: (id: string, updatedFields: any) => Promise<any>;
}

export default function HospitalDashboard({
  user,
  appointments,
  invoices,
  onEmitDocument,
  onLogout,
  onConfirmAppointment,
  accessRequests,
  onAddAccessRequest,
  hospitals = HOSPITALS,
  onVerifyHospital,
  onAddHospital,
  customDocuments = [],
  onUpdateDocument
}: HospitalDashboardProps) {

  // Doctor display name & Hospital
  const doctorName = user.name || 'Médecin';
  const hospital = hospitals.find(h => h.id === user.hospitalId) || null;

  // Consultation state
  const [patientIdentified, setPatientIdentified] = useState<string | null>(null);
  const [patientIdentifierMethod, setPatientIdentifierMethod] = useState<'qr' | 'npi' | 'vocal' | null>(null);
  const [showIdentifierModal, setShowIdentifierModal] = useState(false);
  const [inputNpi, setInputNpi] = useState('');

  // Clinical input (Dictée vocale & Photo)
  const [isDictating, setIsDictating] = useState(false);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [clinicalPhotoAttached, setClinicalPhotoAttached] = useState(false);

  // Prescription (Step 3)
  const [prescriptions, setPrescriptions] = useState<{ name: string; dosage: string }[]>([]);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [showAddMedModal, setShowAddMedModal] = useState(false);

  // Diagnostic Final (Step 4)
  const [finalDiagnosis, setFinalDiagnosis] = useState('');

  // Status & Feedback
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [showFaqModal, setShowFaqModal] = useState(false);

  // Audio Guide
  const speakInstruction = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      window.speechSynthesis.speak(u);
    }
  };

  // Trigger Voice Dictation
  const handleToggleDictation = () => {
    if (isDictating) {
      setIsDictating(false);
      speakInstruction("Dictée vocale terminée et convertie en texte médical.");
    } else {
      setIsDictating(true);
      speakInstruction("Dictée vocale activée. Vous pouvez parler pour décrire les symptômes du patient.");
      // Simulating real-time text transcription
      setTimeout(() => {
        setClinicalNotes(prev => prev + " Auscultation cardio-pulmonaire normale. Pas de signes de gravité neurologique.");
        setIsDictating(false);
      }, 3000);
    }
  };

  // Add Medication Handler
  const handleAddMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) return;
    setPrescriptions(prev => [...prev, { name: newMedName.trim(), dosage: newMedDosage.trim() || 'Selon prescription' }]);
    setNewMedName('');
    setNewMedDosage('');
    setShowAddMedModal(false);
  };

  // Save Consultation Handler
  const handleSaveConsultation = () => {
    setSaveSuccess(true);
    speakInstruction("Consultation enregistrée avec succès dans le registre hospitalier chiffré.");
    setTimeout(() => setSaveSuccess(false), 4000);
  };

  // Send to Patient Handler
  const handleSendToPatient = () => {
    // Emitting medical document to patient
    const newDoc: MedicalDocument = {
      id: `doc-${Date.now()}`,
      title: 'Ordonnance Consultation Médicale',
      type: 'prescription',
      items: prescriptions.map(p => ({ name: `${p.name} - ${p.dosage}`, priceXOF: 2500 })),
      priceXOF: 5000,
      priceSats: 8400,
      patientNpi: 'BJ-1097-8855',
      doctorName: doctorName,
      hospitalName: hospital.name,
      notes: `${finalDiagnosis}\n${clinicalNotes}`,
      date: new Date().toLocaleDateString('fr-FR')
    };

    onEmitDocument(newDoc);
    setSendSuccess(true);
    speakInstruction("Ordonnance et compte-rendu transmis directement sur le passeport e-santé du patient.");
    setTimeout(() => setSendSuccess(false), 5000);
  };

  return (
    <div className="role-dashboard w-full max-w-6xl mx-auto flex flex-col font-sans pb-8">

      {/* ---------------------------------------------------- */}
      {/* EN-TÊTE DU POSTE CLINIQUE (COMPACT & MÉDICAL)        */}
      {/* ---------------------------------------------------- */}
      <div className="bg-white/90 backdrop-blur-xs p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">

        {/* Avatar & Nom du Praticien */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl overflow-hidden border border-emerald-200 shadow-xs bg-slate-100 shrink-0">
            <img
              src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80"
              alt={doctorName}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 font-sans tracking-tight">{doctorName}</h3>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                En consultation
              </span>
            </div>
            <span className="text-xs text-slate-500 font-sans">{hospital.name || 'Hôpital de Zone'}</span>
          </div>
        </div>

        {/* Statut du Jour & Alertes */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>24 Octobre 2026</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold">
            <User className="w-4 h-4 text-amber-700" />
            <span>3 En attente</span>
          </div>
          <button
            onClick={() => speakInstruction("Vous êtes sur le poste de consultation clinique. Étape 1 : Identifiez le patient. Étape 2 : Dictez vos observations. Étape 3 : Prescrivez le traitement. Étape 4 : Validez le diagnostic.")}
            className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors cursor-pointer"
            title="Aide vocale"
          >
            <Headphones className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Messages d'alerte de succès */}
      {saveSuccess && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-3 p-3 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>Consultation enregistrée avec succès dans le dossier patient.</span>
        </motion.div>
      )}

      {sendSuccess && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-3 p-3 bg-blue-50 text-blue-900 border border-blue-300 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0" />
          <span>Ordonnance certifiée et compte-rendu transmis en direct sur le QR Pass du patient.</span>
        </motion.div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2-COLUMN WORKBENCH (VUE COMPACTE SANS DÉFILEMENT)     */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

        {/* COLONNE GAUCHE (5 COLONNES) : IDENTIFICATION & EXAMEN */}
        <div className="lg:col-span-5 space-y-4">

          {/* ÉTAPE 1 : IDENTIFIER LE PATIENT */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center font-black text-[11px]">
                  1
                </span>
                <h4 className="text-sm font-extrabold text-slate-900 font-sans">
                  Identification Patient
                </h4>
              </div>
              {patientIdentified && (
                <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Check className="w-3 h-3" /> NPI BJ-1097-8855
                </span>
              )}
            </div>

            {/* Méthodes de scan */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setPatientIdentifierMethod('qr');
                  speakInstruction("Scan QR Code activé. Patient identifié.");
                  setPatientIdentified('Patient identifié');
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border ${patientIdentifierMethod === 'qr'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-3xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
              >
                <QrCode className="w-4 h-4 text-emerald-700" />
                <span className="text-[11px]">QR Code</span>
              </button>

              <button
                onClick={() => {
                  setPatientIdentifierMethod('npi');
                  setShowIdentifierModal(true);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border ${patientIdentifierMethod === 'npi'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-3xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
              >
                <CreditCard className="w-4 h-4 text-emerald-700" />
                <span className="text-[11px]">NPI National</span>
              </button>

              <button
                onClick={() => {
                  setPatientIdentifierMethod('vocal');
                  speakInstruction("Recherche vocale activée. Patient identifié.");
                  setPatientIdentified('Patient identifié');
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer border ${patientIdentifierMethod === 'vocal'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-3xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
              >
                <Mic className="w-4 h-4 text-emerald-700" />
                <span className="text-[11px]">Vocal</span>
              </button>
            </div>

            {/* Fiche Patient Résumée */}
            {patientIdentified && (
              <div className="p-2.5 bg-emerald-50/50 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-extrabold text-slate-900 block">Patient</span>
                  <span className="text-[10px] text-slate-500 font-mono">Dossier non renseigné</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-emerald-800 block">Tension : 12/8</span>
                  <span className="text-[10px] text-slate-500">Temp : 38.8°C</span>
                </div>
              </div>
            )}
          </div>

          {/* ÉTAPE 2 : SAISIE CLINIQUE & DICTÉE */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center font-black text-[11px]">
                  2
                </span>
                <h4 className="text-sm font-extrabold text-slate-900 font-sans">
                  Observations Cliniques
                </h4>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleToggleDictation}
                  className={`py-1 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${isDictating
                      ? 'bg-red-600 border-red-600 text-white animate-pulse'
                      : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
                    }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span className="text-[11px]">{isDictating ? 'Dictée en cours...' : 'Dictée Vocale'}</span>
                </button>

                <button
                  onClick={() => {
                    setClinicalPhotoAttached(true);
                    speakInstruction("Photo clinique enregistrée.");
                  }}
                  className="py-1 px-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 flex items-center gap-1 transition-all cursor-pointer"
                  title="Ajouter une photo clinique"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span className="text-[11px] hidden sm:inline">{clinicalPhotoAttached ? 'Photo ✓' : 'Photo'}</span>
                </button>
              </div>
            </div>

            <textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              rows={4}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-sans focus:outline-none focus:border-emerald-500 focus:bg-white leading-relaxed"
              placeholder="Notes d'auscultation, symptômes, constantes..."
            />
          </div>

        </div>

        {/* COLONNE DROITE (7 COLONNES) : PRESCRIPTIONS & DIAGNOSTIC */}
        <div className="lg:col-span-7 space-y-4">

          {/* ÉTAPE 3 : PRESCRIPTIONS MÉDICALES */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center font-black text-xs">
                  3
                </span>
                <h4 className="text-sm font-extrabold text-slate-900 font-sans">
                  Prescription & Posologie
                </h4>
              </div>

              <button
                onClick={() => setShowAddMedModal(true)}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <span>+ Ajouter médicament</span>
              </button>
            </div>

            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {prescriptions.map((med, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50/80 hover:bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-extrabold text-slate-900 block">{med.name}</span>
                    <span className="text-slate-500 text-[11px]">{med.dosage}</span>
                  </div>
                  <span className="text-emerald-700 font-black text-sm bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ℞
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ÉTAPE 4 : DIAGNOSTIC FINAL & VALIDATION */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <span className="w-5 h-5 rounded-full bg-emerald-700 text-white flex items-center justify-center font-black text-xs">
                4
              </span>
              <h4 className="text-sm font-extrabold text-slate-900 font-sans">
                Diagnostic & Conduite à Tenir
              </h4>
            </div>

            <input
              type="text"
              value={finalDiagnosis}
              onChange={(e) => setFinalDiagnosis(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-sans text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
              placeholder="Ex : Accès palustre simple, traitement antipaludéen..."
            />

            {/* Boutons d'Action Clés */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={handleSaveConsultation}
                className="py-2.5 px-4 bg-white border-2 border-[#c5ebd7] text-[#007048] hover:bg-[#f1faf6] font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[0_3px_0_#c5ebd7]"
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer dossier</span>
              </button>

              <button
                onClick={handleSendToPatient}
                className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>Transmettre au Patient (Pass NPI)</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Barre d'Assistance Inférieure Discrète */}
      <div className="w-full pt-4 mt-2 flex items-center justify-between text-xs font-medium text-slate-500">
        <button
          onClick={() => setShowFaqModal(true)}
          className="flex items-center gap-1 hover:text-emerald-700 cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5 text-emerald-700" />
          <span>Guide d'utilisation médicale</span>
        </button>

        <span className="text-[11px] text-slate-400">
          Transmission sécurisée du dossier patient
        </span>
      </div>

      {/* MODAL : NPI IDENTIFIER */}
      {showIdentifierModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-gray-900">Saisie Numéro NPI Patient</h3>
            <input
              type="text"
              value={inputNpi}
              onChange={(e) => setInputNpi(e.target.value)}
              placeholder="BJ-XXXX-XXXX"
              className="w-full p-3 border border-gray-200 rounded-2xl text-xs font-mono font-bold"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowIdentifierModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold">Annuler</button>
              <button
                onClick={() => {
                  setPatientIdentified(`Patient NPI : ${inputNpi}`);
                  setShowIdentifierModal(false);
                  speakInstruction(`Patient NPI ${inputNpi} identifié.`);
                }}
                className="px-5 py-2 bg-[#006633] text-white rounded-xl text-xs font-bold"
              >
                Valider
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL : AJOUT MÉDICAMENT */}
      {showAddMedModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-3 shadow-2xl">
            <h3 className="text-base font-black text-gray-900">Prescrire un médicament</h3>
            <form onSubmit={handleAddMedication} className="space-y-3">
              <input
                type="text"
                value={newMedName}
                onChange={(e) => setNewMedName(e.target.value)}
                placeholder="Nom du médicament (Ex: Amoxicilline 500mg)"
                required
                className="w-full p-3 border border-gray-200 rounded-2xl text-xs"
              />
              <input
                type="text"
                value={newMedDosage}
                onChange={(e) => setNewMedDosage(e.target.value)}
                placeholder="Posologie (Ex: 1 gélule 3 fois par jour)"
                required
                className="w-full p-3 border border-gray-200 rounded-2xl text-xs"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddMedModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold">Annuler</button>
                <button type="submit" className="px-5 py-2 bg-[#006633] text-white rounded-xl text-xs font-bold">Ajouter</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL : FAQ */}
      {showFaqModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-900">FAQ Praticien & Consultation</h3>
              <button onClick={() => setShowFaqModal(false)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs text-gray-600">
              <p><strong>Comment identifier le patient ?</strong> Présentez la caméra au QR code du patient ou tapez son numéro NPI.</p>
              <p><strong>Comment fonctionne la dictée vocale ?</strong> Appuyez sur Dictée et dictez vos constatations; elles sont transcrites instantanément.</p>
              <p><strong>Transmission de l'ordonnance :</strong> Le clic sur "Envoyer au patient" ancre l'acte médical et l'envoie sur le QR Pass du patient.</p>
            </div>
            <button onClick={() => setShowFaqModal(false)} className="w-full py-2.5 bg-[#006633] text-white rounded-2xl text-xs font-bold">Fermer</button>
          </motion.div>
        </div>
      )}

    </div>
  );
}
