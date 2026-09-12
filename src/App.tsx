import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AppView, Hospital, Appointment, Invoice, Patient, HospitalUser, MedicalDocument, AccessRequest } from './types';
import { HOSPITALS } from './data';
import HospitalDetails from './components/HospitalDetails';
import AppointmentModal from './components/AppointmentModal';
import WalletTab from './components/WalletTab';
import Auth from './components/Auth';
import LandingPage from './components/LandingPage';
import SanteLogo from './components/SanteLogo';
import { 
  Bell, User, PhoneCall, Wifi, WifiOff, X, ArrowLeft, LogOut,
  ShieldCheck, Activity, Stethoscope, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeRealtime } from './services/realtime';

// Lazy-loaded heavy components for fast 3G/4G loading in Benin
const InteractiveMap = lazy(() => import('./components/InteractiveMap'));
const PaymentFlow = lazy(() => import('./components/PaymentFlow'));
const HospitalDashboard = lazy(() => import('./components/HospitalDashboard'));
const DirectorAdminDashboard = lazy(() => import('./components/DirectorAdminDashboard'));
const PlatformOwnerDashboard = lazy(() => import('./components/PlatformOwnerDashboard'));
const DoctorDashboard = lazy(() => import('./components/DoctorDashboard'));
const UserProfileModal = lazy(() => import('./components/UserProfileModal'));

export default function App() {
  const [view, setView] = useState<AppView>('landing');
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);

  // Connection & Offline states
  const [isManualOffline, setIsManualOffline] = useState<boolean>(() => {
    return localStorage.getItem('sante_manual_offline') === 'true';
  });
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isOffline = !isOnline || isManualOffline;
  const toggleManualOffline = () => {
    const nextVal = !isManualOffline;
    setIsManualOffline(nextVal);
    localStorage.setItem('sante_manual_offline', String(nextVal));
  };

  // Main User & Data States
  const [patientUser, setPatientUser] = useState<Patient | null>(null);
  const [hospitalUser, setHospitalUser] = useState<HospitalUser | null>(null);
  const [customDocuments, setCustomDocuments] = useState<MedicalDocument[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [clinicalRecord, setClinicalRecord] = useState<{ consultations: any[]; prescriptions: any[] }>({ consultations: [], prescriptions: [] });

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [satoshiBalance, setSatoshiBalance] = useState<number>(0);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState<boolean>(false);
  const [initialAuthRole, setInitialAuthRole] = useState<'patient' | 'doctor' | 'hospital'>('patient');

  useEffect(() => {
    if (!patientUser && !hospitalUser) return;

    const refreshPatientData = async () => {
      if (!patientUser) return;
      try {
        const [documentsRes, appointmentsRes, invoicesRes, recordRes] = await Promise.all([
          fetch(`/api/medical-documents?npi=${encodeURIComponent(patientUser.npi || '')}`),
          fetch('/api/appointments'),
          fetch('/api/invoices'),
          fetch('/api/patients/record'),
        ]);
        if (documentsRes.ok) setCustomDocuments(await documentsRes.json());
        if (appointmentsRes.ok) setAppointments(await appointmentsRes.json());
        if (invoicesRes.ok) setInvoices(await invoicesRes.json());
        if (recordRes.ok) {
          const record = await recordRes.json();
          setClinicalRecord(record.data || { consultations: [], prescriptions: [] });
        }
        const profileRes = await fetch('/api/patients/profile');
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          const profile = profileData.data;
          if (profile) {
            setPatientUser(current => current ? {
              ...current,
              name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || current.name,
              npi: profile.npi || current.npi,
              bloodGroup: profile.bloodType || current.bloodGroup,
              allergies: Array.isArray(profile.allergies)
                ? profile.allergies.join(', ')
                : profile.allergies || current.allergies,
              recurringDiseases: Array.isArray(profile.chronicDiseases)
                ? profile.chronicDiseases.join(', ')
                : profile.chronicDiseases || current.recurringDiseases,
            } : current);
          }
        }
      } catch {
        // Keep the current state when the realtime refresh is temporarily unavailable.
      }
    };

    return subscribeRealtime((event) => {
      window.dispatchEvent(new CustomEvent('sante-realtime', { detail: event }));
      if (['appointment', 'medical-document', 'invoice', 'consultation', 'prescription', 'patient'].includes(event.entity)) {
        refreshPatientData();
      }
    });
  }, [patientUser, hospitalUser]);

  // Load hospitals & auto login on startup
  useEffect(() => {
    fetch('/api/hospitals')
      .then(res => res.ok ? res.json() : HOSPITALS)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setHospitals(data);
        else setHospitals(HOSPITALS);
      })
      .catch(() => setHospitals(HOSPITALS));

  }, []);

  // Handlers for Login & Logout
  const handlePatientLogin = (pat: Patient) => {
    localStorage.setItem('sante_role', 'patient');
    localStorage.setItem('sante_patient_email', pat.email);
    localStorage.setItem('sante_patient_profile', JSON.stringify(pat));
    setPatientUser(pat);
    setHospitalUser(null);
    setWalletBalance(pat.walletBalance || 0);
    if (pat.satoshiBalance !== undefined) setSatoshiBalance(pat.satoshiBalance);
    setView('wallet'); // Go to Patient Dashboard
  };

  const handleHospitalLogin = (hUser: HospitalUser) => {
    localStorage.setItem('sante_role', 'hospital');
    const { token: _token, ...safeHospitalUser } = hUser;
    localStorage.setItem('sante_hospital_user', JSON.stringify(safeHospitalUser));
    setHospitalUser(hUser);
    setPatientUser(null);
    setClinicalRecord({ consultations: [], prescriptions: [] });
    // Route selon le rôle
    if (hUser.role === 'superadmin') {
      setView('platform-owner');
    } else if (hUser.role === 'admin') {
      setView('director-admin');
    } else if (hUser.role === 'doctor') {
      setView('doctor-dashboard'); // Médecins avec nouveaux modules
    } else {
      setView('hospital-dashboard'); // Autres (infirmiers, etc.)
    }
  };

  const handleLogout = () => {
    void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    localStorage.removeItem('sante_role');
    localStorage.removeItem('sante_patient_email');
    localStorage.removeItem('sante_patient_profile');
    localStorage.removeItem('sante_hospital_user');
    localStorage.removeItem('sante_hospital_token');
    setPatientUser(null);
    setHospitalUser(null);
    setView('landing');
  };

  // Click logo → retour au bon dashboard selon le rôle actif
  const handleLogoClick = () => {
    if (patientUser) setView('wallet');
    else if (hospitalUser?.role === 'superadmin') setView('platform-owner');
    else if (hospitalUser?.role === 'admin') setView('director-admin');
    else if (hospitalUser?.role === 'doctor') setView('doctor-dashboard');
    else if (hospitalUser) setView('hospital-dashboard');
    else setView('landing');
  };

  const handleSelectRoleFromLanding = (role: 'patient' | 'doctor' | 'hospital') => {
    setInitialAuthRole(role);
    setView('auth');
  };

  const handleEmitDocument = (doc: MedicalDocument) => {
    setCustomDocuments(prev => [doc, ...prev]);
    fetch('/api/medical-documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc)
    }).catch(err => console.error(err));
  };

  const handleConfirmAppointment = (newApt: Appointment) => {
    setAppointments(prev => [newApt, ...prev]);
    fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newApt)
    }).catch(err => console.error(err));
  };

  const handlePaymentComplete = (newInvoice: Invoice) => {
    setInvoices(prev => [newInvoice, ...prev]);
    if (newInvoice.paymentMethod === 'Wallet') {
      setWalletBalance(prev => Math.max(0, prev - newInvoice.totalXOF));
    }
  };

  const speakEmergency = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance("Urgence Médicale activée. En cas de détresse vitale, touchez le bouton vert pour appeler le SAMU au quinze ou les Sapeurs-Pompiers au cent dix-huit.");
      u.lang = 'fr-FR';
      window.speechSynthesis.speak(u);
    }
  };

  // --------------------------------------------------------------------------
  // 1. PAGE AUTH (CONNEXION / INSCRIPTION)
  // --------------------------------------------------------------------------
  if (view === 'auth') {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center font-sans">
        <Auth
          onPatientLogin={handlePatientLogin}
          onHospitalLogin={handleHospitalLogin}
          onClose={() => setView('landing')}
          hospitals={hospitals}
          initialRole={initialAuthRole}
        />
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // 2. MAIN APPLICATION PAGES (SANS MENU LATÉRAL NI ONGLETS DU HAUT)
  // --------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col font-sans text-[#0F172A]">
      
      {/* En-tête épuré médical : Logo Santé+ et Profil */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 px-4 sm:px-8 py-2.5 flex items-center justify-between shadow-xs">
        
        {/* Logo Santé+ avec Badge Officiel */}
        <div 
          onClick={handleLogoClick}
          className="flex items-center gap-3 cursor-pointer select-none group"
        >
          <SanteLogo size="sm" showSubtitle={false} />
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold tracking-tight">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Réseau National e-Santé Bénin
          </span>
        </div>

        {/* Côté Droit : Rôle actif, Notifications & Déconnexion */}
        <div className="flex items-center gap-2.5">
          {patientUser ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-1 pr-2">
              <button
                onClick={() => setShowProfileModal(true)}
                className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs cursor-pointer shadow-xs hover:bg-emerald-700 transition-colors"
                title="Mon profil citoyen"
              >
                {patientUser.name.substring(0, 2).toUpperCase()}
              </button>
              <div 
                onClick={() => setShowProfileModal(true)}
                className="hidden sm:flex flex-col text-left cursor-pointer"
              >
                <span className="text-xs font-bold text-gray-900 leading-tight">{patientUser.name}</span>
                <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> NPI {patientUser.npi || 'Non attribué'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer ml-1"
                title="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : hospitalUser ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-2xl p-1 pr-2">
              <button
                onClick={() => {
                  if (hospitalUser.role === 'admin') setView('director-admin');
                  else if (hospitalUser.role === 'doctor') setView('doctor-dashboard');
                  else setView('hospital-dashboard');
                }}
                className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-blue-200/70 transition-colors"
              >
                {hospitalUser.role === 'doctor' ? (
                  <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                ) : (
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                )}
                <span>{hospitalUser.name || 'Praticien'}</span>
              </button>
              <button
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                title="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setView('auth')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                <span>Accès Sécurisé</span>
              </button>
            </div>
          )}
        </div>

      </header>

      {/* Mode Hors-Ligne si actif */}
      {isOffline && (
        <div className="bg-amber-600 text-white text-xs font-bold py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-xs">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>Mode Hors-ligne Actif : Consultation sécurisée depuis le cache local NPI certifié.</span>
          {isManualOffline && (
            <button onClick={toggleManualOffline} className="underline text-[11px] ml-2 cursor-pointer font-bold">
              Reconnexion
            </button>
          )}
        </div>
      )}

      {/* Corps Principal Calibré (Pleine largeur confortable, centré et compact) */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-5 lg:p-6 overflow-y-auto">
        <Suspense fallback={
          <div className="min-h-[400px] flex flex-col items-center justify-center p-8 space-y-4">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-emerald-800 animate-pulse">Chargement sécurisé Santé+ Bénin...</p>
          </div>
        }>
          <AnimatePresence mode="wait">
          
          {/* VUE 1 : ACCUEIL / LANDING */}
          {view === 'landing' && (
            <motion.div
              key="landing-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <LandingPage
                onSelectRole={handleSelectRoleFromLanding}
                onEnterApp={(initView) => setView(initView)}
                isLoggedIn={!!patientUser}
                onOpenAuth={() => setView('auth')}
                onOpenEmergency={() => setShowEmergencyModal(true)}
              />
            </motion.div>
          )}

          {/* VUE 2 : TABLEAU DE BORD CITOYEN / PATIENT */}
          {view === 'wallet' && (
            <motion.div
              key="wallet-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <WalletTab
                balance={walletBalance}
                setBalance={setWalletBalance}
                satoshiBalance={satoshiBalance}
                setSatoshiBalance={setSatoshiBalance}
                invoices={invoices}
                onSelectInvoice={() => {}}
                accessRequests={accessRequests}
                onApproveAccess={() => {}}
                onRejectAccess={() => {}}
                patientUser={patientUser}
                customDocuments={customDocuments}
                clinicalRecord={clinicalRecord}
                appointments={appointments}
                onNavigateToMap={() => setView('map')}
                onNavigateToAppointments={() => setView('appointments')}
                onOpenProfile={() => setShowProfileModal(true)}
              />
            </motion.div>
          )}


          {/* VUE 3B : TABLEAU DE BORD DIRECTEUR / ADMIN HÔPITAL */}
          {view === 'director-admin' && hospitalUser && hospitalUser.role === 'admin' && (
            <motion.div
              key="director-admin-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <DirectorAdminDashboard
                user={hospitalUser}
                onLogout={handleLogout}
                hospitals={hospitals}
              />
            </motion.div>
          )}

          {view === 'platform-owner' && hospitalUser && hospitalUser.role === 'superadmin' && (
            <motion.div key="platform-owner-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PlatformOwnerDashboard user={hospitalUser} onLogout={handleLogout} />
            </motion.div>
          )}

          {/* VUE 3C : TABLEAU DE BORD MÉDECIN (NOUVEAUX MODULES) */}
          {view === 'doctor-dashboard' && hospitalUser && hospitalUser.role === 'doctor' && (
            <motion.div
              key="doctor-dashboard-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <DoctorDashboard user={hospitalUser} onLogout={handleLogout} />
            </motion.div>
          )}

          {/* VUE 4 : CARTE & HÔPITAUX */}
          {view === 'map' && (
            <motion.div
              key="map-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-6xl mx-auto space-y-4"
            >
              <button
                onClick={() => {
                  if (patientUser) setView('wallet');
                  else if (hospitalUser) setView('hospital-dashboard');
                  else setView('landing');
                }}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-slate-50 rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Retour au tableau de bord</span>
              </button>
              <InteractiveMap
                onSelectHospital={(hosp) => {
                  setSelectedHospital(hosp);
                  setView('hospital-details');
                }}
                onSelectAlreadyThere={(hosp) => {
                  setSelectedHospital(hosp);
                  setView('payment-flow');
                }}
                hospitals={hospitals}
              />
            </motion.div>
          )}

          {/* VUE 5 : DÉTAILS ÉTABLISSEMENT */}
          {view === 'hospital-details' && selectedHospital && (
            <motion.div
              key="hospital-details-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-6xl mx-auto"
            >
              <HospitalDetails
                hospital={selectedHospital}
                onBack={() => setView('map')}
                onBookAppointment={() => setView('appointments')}
                onProceedToPayment={() => setView('payment-flow')}
              />
            </motion.div>
          )}

          {/* VUE 6 : RENDEZ-VOUS */}
          {view === 'appointments' && (
            <motion.div
              key="appointments-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto space-y-4"
            >
              <button
                onClick={() => {
                  if (patientUser) setView('wallet');
                  else setView('map');
                }}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-slate-50 rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Retour</span>
              </button>
              <AppointmentModal
                hospital={selectedHospital || hospitals[0] || HOSPITALS[0]}
                onBack={() => setView('map')}
                onConfirm={handleConfirmAppointment}
                patientUser={patientUser}
              />
            </motion.div>
          )}

          {/* VUE 7 : PAIEMENT DE SOINS */}
          {view === 'payment-flow' && (
            <motion.div
              key="payment-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto space-y-4"
            >
              <button
                onClick={() => {
                  if (patientUser) setView('wallet');
                  else setView('map');
                }}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-slate-50 rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Retour au tableau de bord</span>
              </button>
              <PaymentFlow
                hospital={selectedHospital || hospitals[0] || HOSPITALS[0]}
                walletBalance={walletBalance}
                setWalletBalance={setWalletBalance}
                satoshiBalance={satoshiBalance}
                setSatoshiBalance={setSatoshiBalance}
                patientUser={patientUser}
                userName={patientUser?.name || 'Patient'}
                onBack={() => {
                  if (patientUser) setView('wallet');
                  else setView('map');
                }}
                onPaymentComplete={handlePaymentComplete}
                customDocuments={customDocuments}
              />
            </motion.div>
          )}

        </AnimatePresence>
        </Suspense>
      </main>

      {/* Bouton Flottant d'Urgence Médicale (SAMU 15) */}
      <button
        onClick={() => {
          setShowEmergencyModal(true);
          speakEmergency();
        }}
        className="fixed bottom-5 right-5 z-40 px-3.5 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/30 flex items-center gap-2 font-black text-xs transition-all hover:scale-105 cursor-pointer pulse-emergency border border-red-400"
        title="Bouton Urgence Médicale SAMU 15"
      >
        <PhoneCall className="w-4 h-4 animate-bounce shrink-0" />
        <span className="tracking-wide">URGENCE SAMU 15</span>
      </button>

      {/* Modal d'Urgence Vitale */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 text-center"
          >
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto animate-pulse">
              <PhoneCall className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-black text-gray-900 font-sans">
                Urgence Médicale Bénin
              </h3>
              <p className="text-xs text-gray-500 font-sans mt-1">
                Assistance immédiate 24h/24 et géolocalisation des secours
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <a
                href="tel:15"
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl text-base flex items-center justify-center gap-3 transition-all cursor-pointer shadow-md"
              >
                <PhoneCall className="w-5 h-5" />
                <span>Appeler le SAMU (15)</span>
              </a>

              <a
                href="tel:118"
                className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-3 transition-all cursor-pointer"
              >
                <span>Sapeurs-Pompiers (118)</span>
              </a>

              <button
                onClick={() => {
                  setShowEmergencyModal(false);
                  setView('map');
                }}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-gray-800 font-bold rounded-2xl text-xs transition-all cursor-pointer"
              >
                Itinéraire vers l'hôpital le plus proche
              </button>
            </div>

            <button
              onClick={() => setShowEmergencyModal(false)}
              className="text-xs font-bold text-gray-400 hover:text-gray-600 cursor-pointer pt-2"
            >
              Fermer
            </button>
          </motion.div>
        </div>
      )}

      {/* Modal Profil Patient */}
      {showProfileModal && patientUser && (
        <Suspense fallback={null}>
          <UserProfileModal
            isOpen={showProfileModal}
            onClose={() => setShowProfileModal(false)}
            patient={patientUser}
            onUpdatePatient={(updated) => {
              setPatientUser(updated);
              setShowProfileModal(false);
            }}
            isOffline={isOffline}
          />
        </Suspense>
      )}

      {/* Footer épuré médical */}
      <footer className="w-full bg-white/70 border-t border-slate-200/80 py-3 px-6 text-center text-[11px] text-slate-500 font-sans">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-emerald-900">Santé+ Bénin</span>
            <span>• Infrastructure nationale de santé sécurisée.</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 font-medium">
            <button onClick={() => setView('landing')} className="hover:text-emerald-700 cursor-pointer transition-colors">Mentions Légales</button>
            <button onClick={() => setView('landing')} className="hover:text-emerald-700 cursor-pointer transition-colors">Confidentialité Patient</button>
            <button onClick={() => setView('landing')} className="hover:text-emerald-700 cursor-pointer transition-colors">Normes MSP</button>
          </div>
        </div>
      </footer>

    </div>
  );
}
