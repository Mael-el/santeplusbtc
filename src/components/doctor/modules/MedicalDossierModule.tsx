import React, { useEffect, useState } from 'react';
import { getDoctorPatients, getPatientDossier, Patient, PatientDossier } from '../../../services/doctorApi';
import { 
  FileText, Pill, Activity, ShieldCheck, Folder, Search, User, Droplet, 
  AlertTriangle, Calendar, Paperclip, Eye, Download, Inbox, Share2,
  Stethoscope, Plus, Clock, TrendingUp, Image, Syringe, Heart,
  ChevronRight, Sparkles, Lock, CheckCircle, XCircle
} from 'lucide-react';

interface DoctorData {
  id: string;
  name: string;
}

interface Consultation {
  id: string;
  date: string;
  time: string;
  doctorName: string;
  hospitalName: string;
  reason: string;
  diagnostic: string;
  prescription: string;
  attachments: string[];
  blockchainHash?: string;
}

interface DossierTabsProps {
  tabs: Array<{ key: string; label: string; icon: React.ReactNode; count?: number }>;
  activeTab: string;
  onTabChange: (key: string) => void;
}

function DossierTabs({ tabs, activeTab, onTabChange }: DossierTabsProps) {
  return (
    <div className="flex border-b-2 border-gray-200 mb-6 overflow-x-auto gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`px-4 py-3 font-semibold whitespace-nowrap border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeTab === tab.key
              ? 'border-[#00D26A] text-[#00D26A]'
              : 'border-transparent text-gray-600 hover:text-gray-800'
          }`}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.count !== undefined && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeTab === tab.key ? 'bg-[#00D26A] text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export default function MedicalDossierModule({ 
  doctorData, 
  onStartConsultation,
  onAddPrescription 
}: { 
  doctorData: DoctorData;
  onStartConsultation?: (patientId: string) => void;
  onAddPrescription?: (patientId: string) => void;
}) {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [dossier, setDossier] = useState<PatientDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('consultations');

  useEffect(() => {
    getDoctorPatients()
      .then(data => {
        setPatients(data);
        if (data[0]) setSelectedPatientId(data[0].id);
      })
      .catch(err => setError(err.message || 'Impossible de charger les patients'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleRealtime = (event: Event) => {
      const detail = (event as CustomEvent<{ entity?: string }>).detail;
      if (detail?.entity === 'patient') {
        getDoctorPatients().then(setPatients).catch(() => undefined);
      }
      if (detail?.entity === 'consultation' && selectedPatientId) {
        getPatientDossier(selectedPatientId).then(setDossier).catch(() => undefined);
      }
    };
    window.addEventListener('sante-realtime', handleRealtime);
    return () => window.removeEventListener('sante-realtime', handleRealtime);
  }, [selectedPatientId]);

  useEffect(() => {
    if (!selectedPatientId) return;
    setDossier(null);
    getPatientDossier(selectedPatientId)
      .then(setDossier)
      .catch(err => setError(err.message || 'Impossible de charger le dossier'));
  }, [selectedPatientId]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const patientConsultations = dossier?.consultations || [];

  if (loading) {
    return (
      <section className="py-12 text-center text-gray-500">
        <div className="animate-pulse">Chargement des dossiers...</div>
      </section>
    );
  }

  if (!selectedPatient || !dossier) {
    return (
      <section className="py-12">
        <h2 className="text-4xl font-bold text-[#067A45] mb-8 flex items-center gap-3">
          <FileText className="w-9 h-9" />
          <span>Dossier Médical</span>
        </h2>
        <div className="bg-white rounded-2xl p-10 text-center shadow-md text-gray-500">
          {error || 'Aucun dossier autorisé. Ajoutez d\'abord un patient depuis le module « Mes Patients ».'}
        </div>
      </section>
    );
  }

  const tabs = [
    { key: 'consultations', label: 'Consultations', icon: <FileText className="w-4 h-4" />, count: patientConsultations.length },
    { key: 'prescriptions', label: 'Prescriptions', icon: <Pill className="w-4 h-4" /> },
    { key: 'analyses', label: 'Analyses', icon: <Activity className="w-4 h-4" /> },
    { key: 'imagerie', label: 'Imagerie', icon: <Image className="w-4 h-4" /> },
    { key: 'vitales', label: 'Données vitales', icon: <Heart className="w-4 h-4" /> },
    { key: 'vaccins', label: 'Vaccins', icon: <Syringe className="w-4 h-4" /> },
    { key: 'documents', label: 'Documents', icon: <Folder className="w-4 h-4" /> },
  ];

  return (
    <section className="py-12">
      {/* EN-TÊTE */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-4xl font-bold text-[#067A45] flex items-center gap-3">
          <FileText className="w-9 h-9" />
          <span>Dossier Médical</span>
        </h2>
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full">
          <Lock className="w-4 h-4" />
          <span>Dossier chiffré · Accès journalisé</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* SIDEBAR PATIENTS */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 shadow-md sticky top-24">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Patients autorisés</h3>
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Rechercher un patient..."
                className="w-full h-10 px-3 pl-9 border-2 border-gray-200 rounded-lg focus:border-[#00D26A] focus:outline-none"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  onClick={() => setSelectedPatientId(patient.id)}
                  className={`w-full text-left p-3 rounded-lg transition cursor-pointer ${
                    selectedPatientId === patient.id
                      ? 'bg-[#00D26A] text-white'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <p className="font-semibold">{patient.name}</p>
                  <p className="text-xs opacity-75">{patient.npi}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CONTENU PRINCIPAL */}
        <div className="lg:col-span-3">
          {/* CARTE PATIENT */}
          <div className="bg-white rounded-2xl p-6 shadow-md mb-6 border-l-4 border-[#00D26A]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <User className="w-6 h-6 text-gray-700" />
                  <span>{selectedPatient.name}</span>
                </h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {selectedPatient.age} ans
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-red-600">
                    <Droplet className="w-4 h-4 fill-red-500 text-red-500" />
                    {selectedPatient.blood}
                  </span>
                  {selectedPatient.allergies !== 'Aucune' && (
                    <span className="text-red-500 font-semibold flex items-center gap-1 bg-red-50 px-2 py-1 rounded-md">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {selectedPatient.allergies}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                    <CheckCircle className="w-4 h-4" />
                    Consentement actif
                  </span>
                </div>
              </div>
              <div className="text-right text-sm text-gray-600">
                <p className="font-semibold">{selectedPatient.consultations} consultations</p>
                <p>Dernière visite: {selectedPatient.lastVisit}</p>
              </div>
            </div>

            {/* STATISTIQUES RAPIDES */}
            <div className="grid grid-cols-4 gap-4 mt-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Dernière TA</p>
                <p className="text-lg font-bold text-gray-800">12/8</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Dernier pouls</p>
                <p className="text-lg font-bold text-gray-800">72 bpm</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Température</p>
                <p className="text-lg font-bold text-gray-800">37.2°C</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">IMC</p>
                <p className="text-lg font-bold text-gray-800">25.0</p>
              </div>
            </div>

            {/* ACTIONS PRINCIPALES */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => onStartConsultation?.(selectedPatient.id)}
                className="flex-1 bg-[#00D26A] text-white py-3 rounded-xl font-bold hover:bg-[#067A45] transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Stethoscope className="w-5 h-5" />
                <span>Démarrer une consultation</span>
              </button>
              <button
                onClick={() => onAddPrescription?.(selectedPatient.id)}
                className="bg-white border-2 border-[#00D26A] text-[#00D26A] px-6 py-3 rounded-xl font-bold hover:bg-green-50 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span>Prescription rapide</span>
              </button>
            </div>
          </div>

          {/* ALERTE IA */}
          <div className="bg-purple-50 border-l-4 border-purple-500 rounded-xl p-4 mb-6 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-purple-900">
              <p className="font-semibold">Synthèse IA</p>
              <p className="mt-1">
                Patient sous surveillance tensionnelle post-épisode palustre récent (Octobre 2026). 
                Précédente réaction anaphylactique connue aux bêta-lactamines.
              </p>
            </div>
          </div>

          {/* ONGLETS */}
          <div className="bg-white rounded-2xl p-6 shadow-md">
            <DossierTabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            {/* ONGLET CONSULTATIONS */}
            {activeTab === 'consultations' && (
              <div className="space-y-4">
                {patientConsultations.map((consultation) => (
                  <div
                    key={consultation.id}
                    className="bg-gray-50 rounded-xl p-4 border-l-4 border-[#00D26A] hover:shadow-md transition"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-800 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span>{consultation.date} · {consultation.time} · {consultation.doctorName || doctorData.name}</span>
                        </p>
                        <p className="text-sm text-gray-600 mt-1">Motif: {consultation.reason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-[#00D26A] text-white px-2 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Signé
                        </span>
                        {consultation.blockchainHash && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                            ⛓️ Blockchain
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-sm mb-3">
                      <p className="text-gray-700">
                        <strong>Diagnostic:</strong> {consultation.diagnostic}
                      </p>
                      <p className="text-gray-700">
                        <strong>Prescription:</strong> {consultation.prescription}
                      </p>
                    </div>

                    {consultation.attachments.length > 0 && (
                      <div className="flex gap-2 mb-3 flex-wrap">
                        {consultation.attachments.map((att, i) => (
                          <a
                            key={i}
                            href="#"
                            className="text-xs bg-white border border-gray-300 px-3 py-1 rounded-lg hover:bg-gray-100 flex items-center gap-1"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-gray-500" />
                            <span>{att}</span>
                          </a>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <button className="text-sm text-[#00D26A] font-semibold hover:underline flex items-center gap-1 cursor-pointer">
                        <Eye className="w-4 h-4" />
                        Voir le détail complet
                      </button>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Dossier protégé · Consulté</span>
                      </span>
                    </div>
                  </div>
                ))}

                {patientConsultations.length === 0 && (
                  <div className="text-center py-12 text-gray-600">
                    <Inbox className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>Aucune consultation enregistrée pour ce patient</p>
                  </div>
                )}
              </div>
            )}

            {/* ONGLET PRESCRIPTIONS */}
            {activeTab === 'prescriptions' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-[#00D26A]">
                  <p className="font-bold text-gray-800 flex items-center gap-2">
                    <Pill className="w-4 h-4 text-[#00D26A]" />
                    <span>Ciprofloxacine 500mg</span>
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Fréquence: 2x/jour · 7 jours</p>
                  <p className="text-sm text-gray-600">Prescrit par Dr. Kodjo · 30/06/2026</p>
                  <div className="flex gap-2 mt-3">
                    <button className="text-sm bg-white border border-[#00D26A] text-[#00D26A] px-3 py-1 rounded-lg hover:bg-green-50 cursor-pointer">
                      Renouveler
                    </button>
                    <button className="text-sm bg-white border border-gray-300 text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-100 cursor-pointer">
                      Arrêter
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ONGLET DONNÉES VITALES */}
            {activeTab === 'vitales' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#00D26A]" />
                    Évolution des constantes
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Tension</p>
                      <p className="text-xl font-bold text-gray-800">12/8</p>
                      <p className="text-xs text-emerald-600">Stable</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Pouls</p>
                      <p className="text-xl font-bold text-gray-800">72</p>
                      <p className="text-xs text-emerald-600">Régulier</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Température</p>
                      <p className="text-xl font-bold text-gray-800">37.2</p>
                      <p className="text-xs text-amber-600">Fébricule</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ONGLET IMAGERIE */}
            {activeTab === 'imagerie' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Image className="w-8 h-8 text-[#00D26A]" />
                    <div>
                      <p className="font-bold text-gray-800">Radiographie thoracique</p>
                      <p className="text-sm text-gray-600">15/03/2026 · CHD Atlantique</p>
                    </div>
                  </div>
                  <button className="text-sm bg-white border border-[#00D26A] text-[#00D26A] px-4 py-2 rounded-lg hover:bg-green-50 cursor-pointer">
                    Voir l'image
                  </button>
                </div>
              </div>
            )}

            {/* AUTRES ONGLETS VIDES */}
            {['analyses', 'vaccins', 'documents'].includes(activeTab) && (
              <div className="text-center py-12 text-gray-600">
                <Inbox className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>Aucune donnée disponible pour cet onglet</p>
                <button className="mt-4 text-[#00D26A] hover:underline cursor-pointer flex items-center gap-1 mx-auto">
                  <Plus className="w-4 h-4" />
                  Ajouter une entrée
                </button>
              </div>
            )}
          </div>

          {/* ACTIONS BAS DE PAGE */}
          <div className="flex gap-3 mt-6">
            <button className="flex-1 bg-white border border-[#00D26A] text-[#00D26A] py-3 rounded-xl font-bold hover:bg-green-50 transition flex items-center justify-center gap-2 cursor-pointer">
              <Download className="w-5 h-5" />
              <span>Télécharger tout</span>
            </button>
            <button className="flex-1 bg-white border border-[#00D26A] text-[#00D26A] py-3 rounded-xl font-bold hover:bg-green-50 transition flex items-center justify-center gap-2 cursor-pointer">
              <Share2 className="w-5 h-5" />
              <span>Partager avec un médecin</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}