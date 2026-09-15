import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowRight, CalendarPlus, Camera, Check, CheckCircle2,
  ClipboardList, FileText, HeartPulse, ImagePlus, LockKeyhole, MessageSquare,
  Pill, QrCode, Search, ShieldCheck, Stethoscope, UserPlus, Users, X,
} from 'lucide-react';
import QRScannerModal, { DecodedPatientData } from '../common/QRScannerModal';
import { jsPDF } from 'jspdf';
import {
  addDoctorPatient,
  createAnonymousPatient as createAnonymousPatientApi,
  getDoctorPatients,
  getDoctorStats,
  getConsultationDraft,
  getPatientDossier,
  saveConsultation,
  saveConsultationDraft,
  validateConsultationDraft,
  DoctorStats,
  Patient,
  PatientDossier,
  ConsultationResult,
} from '../../services/doctorApi';

interface DoctorData {
  id: string;
  name: string;
  specialty: string;
  hospitalName: string;
}

type Phase = 'home' | 'identify' | 'dossier' | 'consultation';
type FrameKey = 'history' | 'anamnesis' | 'vitals' | 'exam' | 'diagnosis' | 'prescription' | 'imaging' | 'followup';

const frames: Array<{ key: FrameKey; title: string; description: string; icon: React.ReactNode }> = [
  { key: 'history', title: 'Historique du patient', description: 'Dossier préchargé', icon: <ClipboardList className="h-5 w-5" /> },
  { key: 'anamnesis', title: 'Motif & anamnèse', description: 'Raison de la venue', icon: <MessageSquare className="h-5 w-5" /> },
  { key: 'vitals', title: 'Signes vitaux', description: 'Constantes cliniques', icon: <HeartPulse className="h-5 w-5" /> },
  { key: 'exam', title: 'Examen clinique', description: 'Observations médicales', icon: <Stethoscope className="h-5 w-5" /> },
  { key: 'diagnosis', title: 'Diagnostic', description: 'Principal et secondaire', icon: <Activity className="h-5 w-5" /> },
  { key: 'prescription', title: 'Prescription', description: 'Médicaments et modèles', icon: <Pill className="h-5 w-5" /> },
  { key: 'imaging', title: 'Examens & imagerie', description: 'Pièces et résultats', icon: <ImagePlus className="h-5 w-5" /> },
  { key: 'followup', title: 'Recommandations & suivi', description: 'Suite de la prise en charge', icon: <CalendarPlus className="h-5 w-5" /> },
];

const emptyDossier = (patient: Patient): PatientDossier => ({
  patientId: patient.id,
  patientName: patient.name,
  age: patient.age,
  blood: patient.blood,
  allergies: patient.allergies || 'Aucune',
  consultations: [],
  prescriptions: [],
  vaccines: [],
  bloodDonations: [],
  documents: [],
});

export default function ClinicalWorkspace({ doctorData }: { doctorData?: DoctorData | null; key?: React.Key }) {
  const [phase, setPhase] = useState<Phase>('identify');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [dossier, setDossier] = useState<PatientDossier | null>(null);
  const [stats, setStats] = useState<DoctorStats | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [openFrame, setOpenFrame] = useState<FrameKey>('anamnesis');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ConsultationResult | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [form, setForm] = useState({
    motive: '', anamnesis: '', bloodPressure: '', pulse: '', temperature: '', weight: '', height: '',
    exam: '', diagnosis: '', secondaryDiagnosis: '', medication: '', dosage: '', frequency: '',
    recommendations: '', nextAppointment: '', workLeave: '', imagingNotes: '',
  });

  const refreshSummary = async () => {
    const [patientData, statsData] = await Promise.allSettled([getDoctorPatients(), getDoctorStats()]);
    if (patientData.status === 'fulfilled') setPatients(patientData.value);
    if (statsData.status === 'fulfilled') setStats(statsData.value);
  };

  useEffect(() => {
    refreshSummary();
    const handleRealtime = (event: Event) => {
      const detail = (event as CustomEvent<{ entity?: string }>).detail;
      if (['patient', 'consultation', 'prescription'].includes(detail?.entity || '')) refreshSummary();
    };
    window.addEventListener('sante-realtime', handleRealtime);
    return () => window.removeEventListener('sante-realtime', handleRealtime);
  }, []);

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
    if (selectedPatient) {
      localStorage.setItem(`sante-consultation-${selectedPatient.id}`, JSON.stringify({ ...form, [key]: value, updatedAt: new Date().toISOString() }));
    }
  };

  const openPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setError('');
    setPhase('dossier');
    try {
      setDossier(await getPatientDossier(patient.id));
    } catch {
      setDossier(emptyDossier(patient));
    }
  };

  const identifyPatient = async (value: string) => {
    if (!value.trim()) return;
    try {
      setError('');
      const patient = await addDoctorPatient(value.trim());
      setPatients(current => [patient, ...current.filter(item => item.id !== patient.id)]);
      await openPatient(patient);
    } catch (err: any) {
      setError(err.message || 'Patient introuvable. Vérifiez le NPI, le téléphone ou le nom.');
    }
  };

  const handleScan = (data: DecodedPatientData) => {
    if (data.npi || data.id) identifyPatient(data.npi || data.id || '');
  };

  const createAnonymousPatient = async () => {
    try {
      setError('');
      const patient = await createAnonymousPatientApi();
      setPatients(current => [patient, ...current.filter(item => item.id !== patient.id)]);
      await openPatient(patient);
    } catch (err: any) {
      setError(err.message || 'Impossible de créer la fiche urgence.');
    }
  };

  const startConsultation = () => {
    if (!selectedPatient) return;
    const saved = localStorage.getItem(`sante-consultation-${selectedPatient.id}`);
    if (saved) {
      try { setForm(current => ({ ...current, ...JSON.parse(saved) })); } catch { /* ignore stale draft */ }
    }
    setPhase('consultation');
    getConsultationDraft(selectedPatient.id).then(draft => {
      if (!draft) return;
      setDraftId(draft.id);
      setForm(current => ({ ...current, ...draft.payload }));
    }).catch(() => undefined);
  };

  const exportDossierPdf = () => {
    if (!selectedPatient || !dossier) return;
    const pdf = new jsPDF();
    let y = 20;
    const line = (text: string, size = 10) => {
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(text, 175);
      pdf.text(lines, 18, y);
      y += lines.length * 6 + 3;
      if (y > 275) { pdf.addPage(); y = 20; }
    };
    pdf.setTextColor(8, 127, 91);
    line('SANTE+ BENIN - DOSSIER MEDICAL', 16);
    pdf.setTextColor(24, 51, 43);
    line(`Patient : ${dossier.patientName}`, 12);
    line(`NPI : ${selectedPatient.npi || 'Non attribue'} | Age : ${dossier.age || 'Non renseigne'} ans`);
    line(`Groupe sanguin : ${dossier.blood} | Allergies : ${dossier.allergies}`);
    line(`Consultations : ${dossier.consultations.length} | Ordonnances : ${dossier.prescriptions.length}`);
    line('HISTORIQUE DES CONSULTATIONS', 12);
    dossier.consultations.forEach(item => line(`${item.date} - ${item.doctorName}: ${item.diagnostic}. Prescription: ${item.prescription || 'Aucune'}`));
    line('ORDONNANCES', 12);
    dossier.prescriptions.forEach(item => line(`${item.date} - ${item.medication} ${item.dosage || ''} ${item.frequency || ''} (${item.status})`));
    line(`Document genere le ${new Date().toLocaleString('fr-FR')}`);
    pdf.save(`dossier-${selectedPatient.npi || selectedPatient.id}.pdf`);
  };

  useEffect(() => {
    if (phase !== 'consultation' || !selectedPatient) return;
    const hasContent = Object.values(form).some(Boolean);
    if (!hasContent) return;
    const timer = window.setTimeout(async () => {
      try {
        setDraftSaving(true);
        const draft = await saveConsultationDraft({
          draftId: draftId || undefined,
          patientId: selectedPatient.id,
          patientName: selectedPatient.name,
          payload: { ...form, notes: [
            `Motif: ${form.motive}`,
            `Anamnèse: ${form.anamnesis}`,
            `Constantes: TA ${form.bloodPressure}, pouls ${form.pulse}, température ${form.temperature}, poids ${form.weight}, taille ${form.height}`,
            `Examen: ${form.exam}`,
            `Imagerie: ${form.imagingNotes}`,
            `Suivi: ${form.recommendations}`,
          ].join('\n') },
        });
        setDraftId(draft.id);
      } catch (err: any) {
        setError(err.message || 'Le brouillon n’a pas pu être sauvegardé.');
      } finally {
        setDraftSaving(false);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [form, phase, selectedPatient, draftId]);

  const finishConsultation = async () => {
    if (!selectedPatient || !form.diagnosis.trim()) {
      setError('Le patient et le diagnostic principal sont obligatoires.');
      setOpenFrame('diagnosis');
      return;
    }
    try {
      setSaving(true);
      setError('');
      if (!draftId) {
        setError('Le brouillon est encore en cours de sauvegarde. Réessayez dans un instant.');
        return;
      }
      const consultation = await validateConsultationDraft(draftId);
      setResult(consultation);
      setDraftId(null);
      localStorage.removeItem(`sante-consultation-${selectedPatient.id}`);
      await refreshSummary();
    } catch (err: any) {
      setError(err.message || 'La consultation n’a pas pu être enregistrée.');
    } finally {
      setSaving(false);
    }
  };

  const filteredPatients = useMemo(() => patients.filter(patient => `${patient.name} ${patient.npi || ''}`.toLowerCase().includes(search.toLowerCase())), [patients, search]);
  const frameHasContent = (key: FrameKey) => {
    if (key === 'history') return Boolean(dossier?.consultations.length || dossier?.prescriptions.length);
    if (key === 'anamnesis') return Boolean(form.motive || form.anamnesis);
    if (key === 'vitals') return Boolean(form.bloodPressure || form.pulse || form.temperature || form.weight || form.height);
    if (key === 'exam') return Boolean(form.exam);
    if (key === 'diagnosis') return Boolean(form.diagnosis || form.secondaryDiagnosis);
    if (key === 'prescription') return Boolean(form.medication || form.dosage || form.frequency);
    if (key === 'imaging') return Boolean(form.imagingNotes);
    return Boolean(form.recommendations || form.nextAppointment || form.workLeave);
  };
  const completedFrames = frames.filter(frame => frameHasContent(frame.key)).length;
  const field = (key: keyof typeof form, label: string, placeholder = '') => (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input value={form[key]} onChange={event => updateForm(key, event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-emerald-500" />
    </label>
  );

  return (
    <div className="page-enter min-h-[calc(100vh-80px)] bg-slate-50 px-3 py-4 sm:px-5">
      {phase === 'home' && (
        <main className="mx-auto max-w-6xl space-y-6">
          {/* En-tête du Dashboard Médecin */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div>
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                <Stethoscope className="h-4 w-4" />
                <span>Poste clinique actif</span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-black text-slate-900">
                {doctorData.name}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                {doctorData.specialty} · {doctorData.hospitalName}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setScannerOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                title="Scanner le QR code du patient"
              >
                <QrCode className="h-4 w-4" />
                <span>Scanner QR</span>
              </button>
              <button
                onClick={createAnonymousPatient}
                className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 transition"
                title="Prise en charge d'urgence sans dossier préalable"
              >
                <AlertTriangle className="h-4 w-4" />
                <span>Fiche Urgence</span>
              </button>
            </div>
          </div>

          {/* Statistiques et KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold">Patients aujourd’hui</span>
                <Users className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">{stats?.patientsToday ?? 0}</p>
              <p className="text-[11px] text-emerald-600 mt-1 font-semibold">Consultations réalisées</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold">En attente</span>
                <HeartPulse className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-black text-slate-900">{stats?.appointmentsScheduled ?? 0}</p>
              <p className="text-[11px] text-amber-600 mt-1 font-semibold">File de consultation</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold">Dossiers suivis</span>
                <ClipboardList className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-black text-slate-900">{patients.length}</p>
              <p className="text-[11px] text-blue-600 mt-1 font-semibold">Patientèle active</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-semibold">Ordonnances actives</span>
                <Pill className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-2xl font-black text-slate-900">{stats?.prescriptionsActive ?? 0}</p>
              <p className="text-[11px] text-purple-600 mt-1 font-semibold">Prescriptions en cours</p>
            </div>
          </div>

          {/* Section Liste des Patients & Recherche */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-black text-slate-900">File des patients</h2>
                <p className="text-xs text-slate-500">Sélectionnez un patient pour consulter son dossier ou démarrer une consultation</p>
              </div>
              <div className="relative min-w-[260px] sm:min-w-[320px]">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Rechercher par nom ou NPI..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {error && (
              <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
            )}

            {filteredPatients.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl">
                <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="text-slate-500 text-sm font-semibold">Aucun patient trouvé dans la file active.</p>
                {search.trim() && (
                  <button
                    onClick={() => identifyPatient(search)}
                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                  >
                    Rechercher "{search}" dans le registre national
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {filteredPatients.map(patient => (
                  <div
                    key={patient.id}
                    className="rounded-xl border border-slate-200 p-4 hover:border-emerald-400 hover:shadow-xs transition bg-slate-50/50 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900 text-base">{patient.name}</p>
                        <p className="text-xs font-mono text-emerald-700">{patient.npi || `ID: ${patient.id}`}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {patient.age ? `${patient.age} ans` : 'Âge non renseigné'} · Groupe {patient.blood || 'Non renseigné'}
                        </p>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                        {patient.status === 'urgent' ? 'Urgent' : patient.status === 'new' ? 'Nouveau' : 'Suivi'}
                      </span>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-200/60">
                      <button
                        onClick={() => openPatient(patient)}
                        className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                      >
                        Consulter dossier
                      </button>
                      <button
                        onClick={async () => {
                          await openPatient(patient);
                          startConsultation();
                        }}
                        className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition flex items-center justify-center gap-1.5"
                      >
                        <Stethoscope className="h-3.5 w-3.5" />
                        <span>Consulter</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {phase === 'identify' && (
        <main className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold text-emerald-700">Étape 1 sur 3</p>
                <h1 className="mt-1 text-3xl font-black text-slate-900">Identifier le patient</h1>
                <p className="mt-2 text-sm text-slate-500">Recherchez le dossier par NPI, téléphone, nom ou email avant de commencer la prise en charge.</p>
              </div>
              <Stethoscope className="hidden h-8 w-8 text-emerald-600 sm:block" />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => setScannerOpen(true)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700">
                <QrCode className="h-5 w-5" /> Scanner le QR code
              </button>
              <button onClick={createAnonymousPatient} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-bold text-red-700 hover:bg-red-100">
                <AlertTriangle className="h-5 w-5" /> Urgence sans dossier
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              <input value={identifier} onChange={event => setIdentifier(event.target.value)} onKeyDown={event => event.key === 'Enter' && identifyPatient(identifier)} placeholder="NPI, téléphone, nom ou email" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" />
              <button onClick={() => identifyPatient(identifier)} className="btn-primary rounded-xl px-5 font-bold text-white flex items-center justify-center cursor-pointer shadow-md" aria-label="Rechercher le patient">
                <Search className="h-5 w-5" />
              </button>
            </div>
            {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

            <div className="mt-8 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-700">Historique récent</p>
                  <p className="mt-1 text-xs text-slate-500">Patients déjà autorisés et suivis par votre espace.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{patients.length} dossier(s)</span>
              </div>
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher dans l'historique" className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-emerald-500" />
              {filteredPatients.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {filteredPatients.map(patient => (
                    <button key={patient.id} onClick={() => openPatient(patient)} className="rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-400 hover:bg-emerald-50/40">
                      <span className="block font-bold text-slate-900">{patient.name}</span>
                      <span className="text-xs text-slate-500">{patient.npi || patient.id} · {patient.consultations || 0} consultation(s)</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Aucun historique disponible pour le moment.</p>
              )}
            </div>
          </div>
        </main>
      )}

      {phase === 'dossier' && selectedPatient && dossier && (
        <main className="mx-auto max-w-6xl">
          <button onClick={() => { setPhase('identify'); setSelectedPatient(null); setDossier(null); }} className="mb-5 flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-emerald-700"><ArrowLeft className="h-4 w-4" />Changer de patient</button>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row"><div><p className="text-sm font-bold text-emerald-700">Étape 2 sur 3 · Dossier chargé</p><h1 className="mt-1 text-3xl font-black text-slate-900">{selectedPatient.name}</h1><p className="mt-1 text-sm text-slate-500">{selectedPatient.age || 'Âge non renseigné'} ans · {selectedPatient.blood} · {dossier.allergies}</p></div><div className="flex flex-wrap gap-2"><button onClick={exportDossierPdf} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-black text-slate-700 hover:border-emerald-400"><FileText className="h-5 w-5" />Exporter le dossier</button><button onClick={startConsultation} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-black text-white hover:bg-emerald-700"><Stethoscope className="h-5 w-5" />Démarrer une consultation</button></div></div>
            <div className="mt-7 grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Consultations</p><p className="mt-1 text-2xl font-black">{dossier.consultations.length}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Ordonnances</p><p className="mt-1 text-2xl font-black">{dossier.prescriptions.length}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-500">NPI</p><p className="mt-1 font-mono font-bold">{selectedPatient.npi || 'Non attribué'}</p></div></div>
            <div className="mt-7"><h2 className="text-lg font-black text-slate-900">Historique médical</h2>{dossier.consultations.length ? <div className="mt-3 space-y-2">{dossier.consultations.map(item => <div key={item.id} className="rounded-xl border border-slate-200 p-3"><p className="font-bold">{item.diagnostic}</p><p className="text-xs text-slate-500">{item.date} · {item.doctorName}</p></div>)}</div> : <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">Aucun antécédent enregistré.</p>}</div>
          </div>
        </main>
      )}

      {phase === 'consultation' && selectedPatient && (
        <main className="mx-auto max-w-7xl">
          <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <button onClick={() => setPhase('dossier')} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:border-emerald-400" title="Retour au dossier"><ArrowLeft className="h-4 w-4" /></button>
                <div className="min-w-0"><p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Consultation active</p><h1 className="truncate text-xl font-black text-slate-900">{selectedPatient.name}</h1><p className="truncate text-xs text-slate-500">{selectedPatient.age || 'Âge non renseigné'} ans · {selectedPatient.blood} · NPI {selectedPatient.npi || 'non attribué'}</p></div>
              </div>
              <div className="flex items-center gap-2"><span className="hidden rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-500 sm:inline-flex"><LockKeyhole className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />{draftSaving ? 'Sauvegarde du brouillon...' : 'Brouillon privé sauvegardé'}</span><button onClick={finishConsultation} disabled={saving || draftSaving} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 sm:flex-none">{saving ? 'Validation...' : 'VALIDER ET ENVOYER AU PATIENT'}</button></div>
            </div>
          </div>
          {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3"><div><p className="text-sm font-black text-emerald-950">Parcours de soins</p><p className="text-xs text-emerald-800">Ouvrez les cadres dans l’ordre qui vous convient.</p></div><span className="text-sm font-black text-emerald-700">{completedFrames}/8 complétés</span></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{frames.map((frame, index) => { const complete = frameHasContent(frame.key); return <button key={frame.key} onClick={() => setOpenFrame(frame.key)} className={`group min-h-[112px] rounded-2xl border p-4 text-left transition-all ${openFrame === frame.key ? 'border-emerald-500 bg-white shadow-md ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm'}`}><div className="flex items-start justify-between"><span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black ${openFrame === frame.key ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span>{complete ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <span className="h-2 w-2 rounded-full bg-slate-200" />}</div><div className="mt-3 flex items-center gap-2 text-slate-900"> <span className="text-emerald-700">{frame.icon}</span><span className="font-black">{frame.title}</span></div><p className="mt-1 text-xs text-slate-500">{complete ? 'Informations saisies' : frame.description}</p></button>; })}</div>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4"><div><p className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Cadre {frames.findIndex(frame => frame.key === openFrame) + 1} sur 8</p><h2 className="mt-1 text-xl font-black text-slate-900">{frames.find(frame => frame.key === openFrame)?.title}</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{frameHasContent(openFrame) ? 'Renseigné' : 'À compléter'}</span></div>
            {openFrame === 'history' && <div><h2 className="text-xl font-black">Historique préchargé</h2><p className="mt-2 text-sm text-slate-500">{dossier?.consultations.length || 0} consultation(s), {dossier?.prescriptions.length || 0} ordonnance(s), allergies : {dossier?.allergies || 'Aucune'}.</p></div>}
            {openFrame === 'anamnesis' && <div className="grid gap-4 md:grid-cols-2">{field('motive', 'Motif de consultation', 'Pourquoi le patient consulte ?')}<label className="text-sm font-semibold text-slate-700 md:col-span-2">Anamnèse<textarea value={form.anamnesis} onChange={event => updateForm('anamnesis', event.target.value)} rows={5} className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-emerald-500" /></label></div>}
            {openFrame === 'vitals' && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{field('bloodPressure', 'Tension', '120/80 mmHg')}{field('pulse', 'Pouls', '72 bpm')}{field('temperature', 'Température', '37 °C')}{field('weight', 'Poids', '70 kg')}{field('height', 'Taille', '175 cm')}<div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">IMC calculé après saisie du poids et de la taille.</div></div>}
            {openFrame === 'exam' && <label className="text-sm font-semibold text-slate-700">Examen clinique<textarea value={form.exam} onChange={event => updateForm('exam', event.target.value)} rows={7} className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-emerald-500" placeholder="Observations, auscultation, examen physique..." /></label>}
            {openFrame === 'diagnosis' && <div className="grid gap-4 md:grid-cols-2">{field('diagnosis', 'Diagnostic principal', 'Diagnostic obligatoire')}{field('secondaryDiagnosis', 'Diagnostic secondaire', 'Optionnel')}<div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 md:col-span-2"><ShieldCheck className="mr-2 inline h-4 w-4" />Assistance IA disponible dans le module Assistant. Toute suggestion doit être validée par le praticien.</div></div>}
            {openFrame === 'prescription' && <div className="grid gap-4 md:grid-cols-3">{field('medication', 'Médicament', 'Nom et dosage')}{field('dosage', 'Posologie', '1 comprimé')}{field('frequency', 'Fréquence', '2 fois par jour')}<div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 md:col-span-3"><Pill className="mr-2 inline h-4 w-4 text-emerald-700" />Vérifiez les interactions avant validation de l’ordonnance.</div></div>}
            {openFrame === 'imaging' && <div><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-8 text-sm font-bold text-slate-600 hover:border-emerald-500"><ImagePlus className="h-5 w-5" />Ajouter une image ou un examen<input type="file" accept="image/*,.pdf,.dcm" className="hidden" /></label>{field('imagingNotes', 'Note d’imagerie', 'Résultat ou description')}</div>}
            {openFrame === 'followup' && <div className="grid gap-4 md:grid-cols-2">{field('nextAppointment', 'Prochain rendez-vous', 'Date et heure')}{field('workLeave', 'Arrêt de travail', 'Période')}<label className="text-sm font-semibold text-slate-700 md:col-span-2">Recommandations<textarea value={form.recommendations} onChange={event => updateForm('recommendations', event.target.value)} rows={5} className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-emerald-500" /></label></div>}
          </div>
        </main>
      )}

      {result && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center gap-3"><div className="rounded-full bg-emerald-100 p-3 text-emerald-700"><Check className="h-6 w-6" /></div><div><h2 className="text-xl font-black">Consultation validée et envoyée</h2><p className="text-sm text-slate-500">Le patient peut maintenant consulter la version finale dans son espace.</p></div></div><div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm"><p><b>Patient :</b> {result.patientName}</p><p className="mt-1 text-emerald-700">Dossier et ordonnance transmis avec succès.</p></div><button onClick={() => { setResult(null); setPhase('identify'); setSelectedPatient(null); setDossier(null); }} className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 font-black text-white">Identifier le patient suivant</button></div></div>}
      <QRScannerModal isOpen={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </div>
  );
}
