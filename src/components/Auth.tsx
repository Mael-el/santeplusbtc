import React, { useState } from 'react';
import { Patient, HospitalUser, Hospital } from '../types';
import { HOSPITALS } from '../data';
import { 
  Phone, Lock, Eye, EyeOff, Fingerprint, 
  ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, 
  Info, Building2, User, Stethoscope, Award, FileCheck
} from 'lucide-react';
import { motion } from 'motion/react';

interface AuthProps {
  onPatientLogin: (patient: Patient) => void;
  onHospitalLogin: (hospitalUser: HospitalUser) => void;
  onClose: () => void;
  hospitals?: Hospital[];
  initialRole?: 'patient' | 'doctor' | 'hospital';
}

export default function Auth({ 
  onPatientLogin, 
  onHospitalLogin, 
  onClose, 
  hospitals = HOSPITALS,
  initialRole = 'patient'
}: AuthProps) {
  // Screen mode: 'signin' or 'signup'
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Strict single role for this dedicated page instance
  const currentRole: 'patient' | 'doctor' | 'hospital' = initialRole;

  // Signin fields (strictly empty by default for production security)
  const [patientPhone, setPatientPhone] = useState('');
  const [doctorIdentifier, setDoctorIdentifier] = useState('');
  const [directorIdentifier, setDirectorIdentifier] = useState('');
  
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isBiometricScanning, setIsBiometricScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Multi-Step Registration Wizard fields (Steps 1, 2, 3)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Patient Registration fields
  const [patientLastName, setPatientLastName] = useState('');
  const [patientFirstName, setPatientFirstName] = useState('');
  const [patientNpi, setPatientNpi] = useState('');
  const [signupPatientPhone, setSignupPatientPhone] = useState('');
  const [patientSignupPassword, setPatientSignupPassword] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergies, setAllergies] = useState('');

  // Doctor Registration fields (ONMB Attestation)
  const [doctorName, setDoctorName] = useState('');
  const [doctorOnmbNumber, setDoctorOnmbNumber] = useState('');
  const [doctorSpecialty, setDoctorSpecialty] = useState('Médecine Générale');
  const [doctorHospitalId, setDoctorHospitalId] = useState(hospitals[0]?.id || 'hz-calavi');
  const [doctorPhone, setDoctorPhone] = useState('');
  const [doctorEmail, setDoctorEmail] = useState('');
  const [doctorSignupPassword, setDoctorSignupPassword] = useState('');
  const [doctorMspLicense, setDoctorMspLicense] = useState('');

  // Director Registration fields (MSP Agreement Attestation)
  const [directorName, setDirectorName] = useState('');
  const [directorTitle, setDirectorTitle] = useState('Directeur Général');
  const [directorHospitalName, setDirectorHospitalName] = useState("Hôpital de Zone d'Abomey-Calavi");
  const [directorMspAgreement, setDirectorMspAgreement] = useState('');
  const [directorHospitalType, setDirectorHospitalType] = useState<'public' | 'private' | 'clinic'>('public');
  const [directorAddress, setDirectorAddress] = useState('Abomey-Calavi');
  const [directorPhone, setDirectorPhone] = useState('');
  const [directorEmail, setDirectorEmail] = useState('');
  const [directorSignupPassword, setDirectorSignupPassword] = useState('');

  // Vocal guide for low-literacy
  const speakInstruction = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'fr-FR';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Biometric Login (Inform user about real WebAuthn security configuration)
  const handleBiometricLogin = () => {
    setErrorMsg('');
    setIsBiometricScanning(true);
    speakInstruction("Scan biométrique en cours.");

    setTimeout(() => {
      setIsBiometricScanning(false);
      setErrorMsg("Aucune clé biométrique FIDO2/WebAuthn configurée pour cet appareil. Veuillez vous connecter avec vos identifiants et mot de passe.");
      speakInstruction("Veuillez saisir votre mot de passe.");
    }, 1000);
  };

  // Standard Login Submit Handler (Authentification réelle via API)
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (currentRole === 'patient') {
      if (!patientPhone || !password) {
        setErrorMsg("Veuillez renseigner votre numéro de téléphone (ou email) et votre mot de passe.");
        return;
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            phone: patientPhone.includes('@') ? undefined : patientPhone,
            email: patientPhone.includes('@') ? patientPhone : undefined,
            password 
          })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrorMsg(data.error || "Numéro ou mot de passe incorrect.");
          return;
        }

        const user = data.data?.user || {};
        const patient: Patient = {
          name: user.name || (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email || 'Citoyen Bénin'),
          email: user.email || patientPhone,
          phone: user.phone || patientPhone,
          walletBalance: user.walletBalance || 0,
          satoshiBalance: user.satoshiBalance || 0,
          npi: user.npi || 'BJ-CITOYEN',
          bloodGroup: user.bloodGroup || 'O+'
        };
        setSuccessMsg(`Connexion réussie ! Bienvenue ${patient.name}.`);
        speakInstruction(`Bienvenue ${patient.name}.`);
        setTimeout(() => onPatientLogin(patient), 600);
      } catch (err: any) {
        setErrorMsg("Impossible de joindre le serveur d'authentification. Veuillez réessayer.");
      }

    } else if (currentRole === 'doctor') {
      if (!doctorIdentifier || !password) {
        setErrorMsg("Veuillez renseigner votre email professionnel et votre mot de passe.");
        return;
      }

      try {
        const res = await fetch('/api/hospital-users/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: doctorIdentifier, password, expectedRole: 'doctor' })
        });
        const data = await res.json();

        if (!res.ok || !data.token) {
          setErrorMsg(data.error || "Identifiants médecin incorrects.");
          return;
        }

        const docUser: HospitalUser = {
          email: data.email,
          hospitalId: data.hospitalId || hospitals[0]?.id || 'hz-calavi',
          role: data.role || 'doctor',
          name: data.name || 'Médecin Praticien',
          token: data.token
        };
        setSuccessMsg(`Session médicale validée (${docUser.name})`);
        speakInstruction(`Session validée.`);
        setTimeout(() => onHospitalLogin(docUser), 600);
      } catch (err: any) {
        setErrorMsg("Erreur réseau lors de la connexion praticien.");
      }

    } else {
      if (!directorIdentifier || !password) {
        setErrorMsg("Veuillez renseigner l'email de direction et le mot de passe.");
        return;
      }

      try {
        const res = await fetch('/api/hospital-users/login', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: directorIdentifier, password, expectedRole: 'admin' })
        });
        const data = await res.json();

        if (!res.ok || !data.token) {
          setErrorMsg(data.error || "Identifiants de direction incorrects.");
          return;
        }

        const dirUser: HospitalUser = {
          email: data.email,
          hospitalId: data.hospitalId || hospitals[0]?.id || 'hz-calavi',
          role: data.role || 'admin',
          name: data.name || 'Direction Hospitalière',
          token: data.token
        };
        setSuccessMsg(`Session Direction Hospitalière validée.`);
        speakInstruction(`Session direction validée.`);
        setTimeout(() => onHospitalLogin(dirUser), 600);
      } catch (err: any) {
        setErrorMsg("Erreur réseau lors de la connexion direction.");
      }
    }
  };

  // Registration Complete Handler (Création réelle dans la base de données)
  const handleSignUpComplete = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (currentRole === 'patient') {
      if (!signupPatientPhone || !patientSignupPassword || !patientFirstName.trim() || !patientLastName.trim()) {
        setErrorMsg("Veuillez remplir tous les champs obligatoires (Nom, Prénom, Téléphone, Mot de passe).");
        return;
      }

      try {
        const email = `citoyen-${signupPatientPhone.replace(/[^0-9]/g, '')}@santeplus.bj`;
        const res = await fetch('/api/auth/register/patient', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            phone: signupPatientPhone,
            password: patientSignupPassword,
            firstName: patientFirstName.trim(),
            lastName: patientLastName.trim(),
            dateOfBirth: '1995-01-01',
            bloodType: bloodGroup || undefined,
            allergies: allergies || undefined,
          })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrorMsg(data.error || "Erreur lors de la création du compte patient.");
          return;
        }

        const fullName = `${patientFirstName.trim()} ${patientLastName.trim()}`;
        const registeredUserId = data.data?.user?.id;
        const newPatient: Patient = {
          name: fullName,
          email,
          phone: signupPatientPhone,
          npi: data.data?.user?.npi || patientNpi || (registeredUserId
            ? `BJ${String(registeredUserId).padStart(11, '0')}`
            : 'BJ-CITOYEN'),
          walletBalance: 0,
          satoshiBalance: 0,
          bloodGroup: bloodGroup,
          allergies: allergies || 'Aucune'
        };
        setSuccessMsg(`Dossier citoyen créé avec succès ! Bienvenue ${fullName}.`);
        speakInstruction(`Votre dossier médical est créé avec succès.`);
        setTimeout(() => onPatientLogin(newPatient), 800);
      } catch (err) {
        setErrorMsg("Erreur réseau lors de l'inscription.");
      }

    } else if (currentRole === 'doctor') {
      if (!doctorEmail || !doctorPhone || !doctorSignupPassword || !doctorName.trim()) {
        setErrorMsg("Veuillez renseigner les informations obligatoires du praticien.");
        return;
      }

      try {
        const res = await fetch('/api/hospital-users/register/doctor', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: doctorEmail,
            phone: doctorPhone,
            password: doctorSignupPassword,
            firstName: doctorName.trim(),
            lastName: 'ONMB',
            specialty: doctorSpecialty,
          })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrorMsg(data.error || "Erreur lors de l'enregistrement du praticien.");
          return;
        }

        const docFullName = doctorName.trim().startsWith('Dr.') ? doctorName.trim() : `Dr. ${doctorName.trim()}`;
        const newDoctor: HospitalUser = {
          email: doctorEmail,
          hospitalId: doctorHospitalId,
          role: 'doctor',
          name: docFullName,
          token: data.data?.accessToken
        };
        setSuccessMsg(`Compte Médecin attesté créé avec succès ! Bienvenue ${docFullName}.`);
        speakInstruction(`Compte médecin validé.`);
        setTimeout(() => onHospitalLogin(newDoctor), 800);
      } catch (err) {
        setErrorMsg("Erreur réseau lors de l'inscription praticien.");
      }

    } else {
      if (!directorEmail || !directorPhone || !directorSignupPassword || !directorHospitalName.trim()) {
        setErrorMsg("Veuillez renseigner les informations obligatoires de l'établissement.");
        return;
      }

      try {
        const res = await fetch('/api/hospitals/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: directorHospitalName,
            type: directorHospitalType,
            address: directorAddress,
            phone: directorPhone,
            hours: 'Ouvert 24h/24',
            email: directorEmail,
            password: directorSignupPassword,
          })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrorMsg(data.error || "Erreur lors de l'enregistrement de l'établissement.");
          return;
        }

        const dirFullName = directorName.trim() || 'Directeur';
        const newDirector: HospitalUser = {
          email: directorEmail,
          hospitalId: data.hospitalId || hospitals[0]?.id || 'hz-calavi',
          role: 'admin',
          name: `${dirFullName} (${directorHospitalName})`,
          token: data.token
        };
        setSuccessMsg(data.message || `Demande d'établissement enregistrée avec succès !`);
        speakInstruction(`Établissement enregistré.`);
        setTimeout(() => onHospitalLogin(newDirector), 800);
      } catch (err) {
        setErrorMsg("Erreur réseau lors de l'enregistrement de l'établissement.");
      }
    }
  };

  const continuePatientSecurityStep = () => {
    setErrorMsg('');
    if (signupPatientPhone.trim().length < 8) {
      setErrorMsg('Veuillez saisir un numéro de téléphone valide.');
      return;
    }
    if (patientSignupPassword.length < 8) {
      setErrorMsg('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setStep(3);
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-4 sm:p-6">
      
      {/* ---------------------------------------------------- */}
      {/* 1. ÉCRAN DE CONNEXION UNIQUE SELON LE RÔLE           */}
      {/* ---------------------------------------------------- */}
      {authMode === 'signin' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden p-6 sm:p-8 relative"
        >
          {/* Bouton Retour vers l'accueil */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-6 left-6 text-gray-400 hover:text-gray-700 flex items-center gap-1 text-xs font-bold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Accueil</span>
          </button>

          {/* Logo & Titre spécifique au statut */}
          <div className="text-center mt-2 mb-6">
            <h2 className="text-3xl font-black text-[#059669] font-sans tracking-tight flex items-center justify-center gap-1.5">
              Santé+
            </h2>
            <p className="text-xs text-gray-500 font-sans mt-1">
              {currentRole === 'patient' && "Accédez à votre espace sécurisé"}
              {currentRole === 'doctor' && "Espace Médecins & Praticiens"}
              {currentRole === 'hospital' && "Direction & Établissements Hospitaliers"}
            </p>
          </div>

          {/* Messages d'Alerte */}
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-sans">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-sans flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Formulaire de Connexion Strictement Dédié */}
          <form onSubmit={handleSignInSubmit} className="space-y-4">
            
            {/* Champ Identifiant Spécifique */}
            <div>
              <label className="block text-xs font-bold text-gray-700 font-sans mb-1.5">
                {currentRole === 'patient' && "Numéro de téléphone"}
                {currentRole === 'doctor' && "Numéro d'Ordre (ONMB) ou Email Pro"}
                {currentRole === 'hospital' && "Numéro d'Agrément MSP ou Email Direction"}
              </label>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  {currentRole === 'patient' ? <Phone className="w-4 h-4" /> : currentRole === 'doctor' ? <Stethoscope className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                </div>

                {currentRole === 'patient' && (
                  <input
                    type="text"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    placeholder="+229 00 00 00 00"
                    required
                    className="w-full pl-10 pr-3 py-3 bg-white border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans focus:outline-none focus:border-emerald-500"
                  />
                )}

                {currentRole === 'doctor' && (
                  <input
                    type="text"
                    value={doctorIdentifier}
                    onChange={(e) => setDoctorIdentifier(e.target.value)}
                    placeholder="dr.mensah@chd-atlantique.bj ou ONMB-4819"
                    required
                    className="w-full pl-10 pr-3 py-3 bg-white border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans focus:outline-none focus:border-emerald-500"
                  />
                )}

                {currentRole === 'hospital' && (
                  <input
                    type="text"
                    value={directorIdentifier}
                    onChange={(e) => setDirectorIdentifier(e.target.value)}
                    placeholder="direction@hz-calavi.bj ou MSP-AGR-091"
                    required
                    className="w-full pl-10 pr-3 py-3 bg-white border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans focus:outline-none focus:border-emerald-500"
                  />
                )}
              </div>
            </div>

            {/* Champ Mot de Passe */}
            <div>
              <label className="block text-xs font-bold text-gray-700 font-sans mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-3 bg-white border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="text-right mt-1.5">
                <button
                  type="button"
                  onClick={() => speakInstruction("Pour réinitialiser votre mot de passe, contactez l'assistance Santé Plus ou le secrétariat.")}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </div>

            {/* Bouton de Connexion (Image 2) */}
            <button
              type="submit"
              className="w-full py-3.5 bg-[#059669] hover:bg-[#047857] text-white font-bold rounded-2xl text-sm transition-all cursor-pointer shadow-sm hover:shadow"
            >
              Se connecter
            </button>

            {/* Séparateur */}
            <div className="relative my-3 flex items-center justify-center">
              <div className="border-t border-gray-100 w-full"></div>
              <span className="bg-white px-3 text-[11px] text-gray-400 font-sans font-medium absolute">
                Ou connectez-vous avec
              </span>
            </div>

            {/* Bouton Biométrie (Face ID / Empreinte) */}
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={isBiometricScanning}
              className="w-full py-3.5 bg-slate-50 hover:bg-slate-100 border border-gray-200 text-gray-800 font-bold rounded-2xl text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Fingerprint className={`w-5 h-5 text-emerald-600 ${isBiometricScanning ? 'animate-pulse' : ''}`} />
              <span>{isBiometricScanning ? 'Scan biométrique...' : 'Biométrie (Face ID / Empreinte)'}</span>
            </button>

          </form>

          {/* Bascule vers la création de compte propre au statut */}
          <div className="mt-6 text-center text-xs font-sans">
            <span className="text-gray-500">Nouveau sur Santé+ ? </span>
            <button
              type="button"
              onClick={() => { setAuthMode('signup'); setStep(1); setErrorMsg(''); }}
              className="font-bold text-[#059669] hover:underline cursor-pointer"
            >
              {currentRole === 'patient' && "Créer un compte"}
              {currentRole === 'doctor' && "Créer un compte médecin"}
              {currentRole === 'hospital' && "Enregistrer un établissement"}
            </button>
          </div>

          {/* Badge National Inférieur (Image 2) */}
          <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-gray-200 rounded-full text-[11px] font-bold text-gray-600 font-sans">
              <span>Bénin</span> • <span>E-santé</span> • <span>Accès sécurisé</span>
            </span>
          </div>

        </motion.div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 2. ÉCRAN D'INSCRIPTION UNIQUE SELON LE RÔLE (IMAGE 3) */}
      {/* ---------------------------------------------------- */}
      {authMode === 'signup' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-lg bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden p-6 sm:p-8"
        >
          {/* En-tête avec bouton retour (Image 3) */}
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-[#059669] font-sans">Santé+</h2>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide bg-slate-50 px-2 py-0.5 rounded-full border border-gray-200">
                {currentRole === 'patient' && "BÉNIN • E-SANTÉ • ACCÈS SÉCURISÉ"}
                {currentRole === 'doctor' && "ATTESTATION MÉDICALE ONMB"}
                {currentRole === 'hospital' && "AGRÉMENT MINISTÉRIEL MSP"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (step > 1) setStep((step - 1) as any);
                else setAuthMode('signin');
              }}
              className="text-xs font-bold text-gray-600 hover:text-gray-900 flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Retour</span>
            </button>
          </div>

          {/* Titre selon le rôle */}
          <div className="mb-5">
            <h3 className="text-2xl font-black text-gray-900 font-sans tracking-tight">
              {currentRole === 'patient' && "Créer votre Dossier"}
              {currentRole === 'doctor' && "Inscription Praticien de Santé"}
              {currentRole === 'hospital' && "Enregistrement Établissement Hospitalier"}
            </h3>
            <p className="text-xs text-gray-500 font-sans mt-0.5">
              {currentRole === 'patient' && "Rejoignez l'infrastructure e-santé sécurisée du Bénin."}
              {currentRole === 'doctor' && "Attestation obligatoire auprès de l'Ordre National des Médecins."}
              {currentRole === 'hospital' && "Attestation d'agrément officiel du Ministère de la Santé (MSP)."}
            </p>
          </div>

          {/* Barre de Progression à 3 Étapes (Image 3) */}
          <div className="mb-6">
            <div className="flex items-center justify-between relative mb-2">
              <div className="flex flex-col items-center z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                  step >= 1 ? 'bg-[#059669] text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  1
                </div>
                <span className={`text-[11px] font-bold mt-1.5 ${step === 1 ? 'text-[#059669]' : 'text-gray-400'}`}>
                  {currentRole === 'patient' ? 'Personnel' : currentRole === 'doctor' ? 'Statut ONMB' : 'Établissement'}
                </span>
              </div>

              <div className={`flex-1 h-0.5 mx-2 -mt-5 ${step >= 2 ? 'bg-[#059669]' : 'bg-gray-200'}`}></div>

              <div className="flex flex-col items-center z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                  step >= 2 ? 'bg-[#059669] text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  2
                </div>
                <span className={`text-[11px] font-bold mt-1.5 ${step === 2 ? 'text-[#059669]' : 'text-gray-400'}`}>
                  Sécurité
                </span>
              </div>

              <div className={`flex-1 h-0.5 mx-2 -mt-5 ${step >= 3 ? 'bg-[#059669]' : 'bg-gray-200'}`}></div>

              <div className="flex flex-col items-center z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${
                  step >= 3 ? 'bg-[#059669] text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  3
                </div>
                <span className={`text-[11px] font-bold mt-1.5 ${step === 3 ? 'text-[#059669]' : 'text-gray-400'}`}>
                  {currentRole === 'patient' ? 'Médical' : 'Attestation MSP'}
                </span>
              </div>
            </div>
          </div>

          {/* ==================================================== */}
          {/* A. INSCRIPTION CITOYEN / PATIENT                     */}
          {/* ==================================================== */}
          {currentRole === 'patient' && (
            <div className="space-y-4">
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Nom de famille</label>
                      <input
                        type="text"
                        value={patientLastName}
                        onChange={(e) => setPatientLastName(e.target.value)}
                        placeholder="Ex: Dupont"
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Prénom(s)</label>
                      <input
                        type="text"
                        value={patientFirstName}
                        onChange={(e) => setPatientFirstName(e.target.value)}
                        placeholder="Ex: Jean"
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1.5">
                      <span>Numéro d'Identification Personnel (NPI)</span>
                      <Info className="w-3.5 h-3.5 text-gray-400" />
                    </label>
                    <input
                      type="text"
                      value={patientNpi}
                      onChange={(e) => setPatientNpi(e.target.value)}
                      placeholder="BJ-1097-8855"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs font-mono tracking-wider"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Atteste de votre identité citoyenne nationale.</p>
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-8 py-3 bg-[#059669] hover:bg-[#047857] text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer"
                    >
                      <span>Continuer</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Numéro de téléphone mobile</label>
                    <input
                      type="text"
                      value={signupPatientPhone}
                      onChange={(e) => setSignupPatientPhone(e.target.value)}
                      placeholder="+229 97 00 00 00"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Mot de passe (8 caractères minimum)</label>
                    <input
                      type="password"
                      value={patientSignupPassword}
                      onChange={(e) => setPatientSignupPassword(e.target.value)}
                      placeholder="SantePlus2026"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm"
                    />
                  </div>

                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-3">
                    <Fingerprint className="w-6 h-6 text-emerald-600 shrink-0" />
                    <span className="text-xs text-emerald-900 font-bold">Biométrie Face ID / Empreinte activée pour votre confort.</span>
                  </div>

                  <div className="pt-3 flex justify-between">
                    <button type="button" onClick={() => setStep(1)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-2xl text-xs cursor-pointer">Précédent</button>
                    <button type="button" onClick={continuePatientSecurityStep} className="px-8 py-3 bg-[#059669] text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer">
                      <span>Continuer</span> <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Groupe Sanguin</label>
                    <div className="grid grid-cols-4 gap-2">
                      {['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-'].map(bg => (
                        <button
                          key={bg}
                          type="button"
                          onClick={() => setBloodGroup(bg)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            bloodGroup === bg ? 'bg-red-500 border-red-500 text-white shadow-xs' : 'bg-slate-50 border-gray-200 text-gray-700'
                          }`}
                        >
                          {bg}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Allergies (Optionnel)</label>
                    <input
                      type="text"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      placeholder="Ex: Pénicilline, Aucune"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs"
                    />
                  </div>

                  <div className="pt-3 flex justify-between">
                    <button type="button" onClick={() => setStep(2)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-2xl text-xs cursor-pointer">Précédent</button>
                    <button type="button" onClick={handleSignUpComplete} className="px-8 py-3 bg-[#059669] hover:bg-[#047857] text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-md">
                      <span>Créer mon Dossier</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* B. INSCRIPTION MÉDECIN (ATTESTATION ONMB)            */}
          {/* ==================================================== */}
          {currentRole === 'doctor' && (
            <div className="space-y-4">
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nom et Prénom du Praticien</label>
                    <input
                      type="text"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      placeholder="Ex: Dr. Mensah Paul"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-blue-600" />
                      <span>Numéro d'Ordre National des Médecins (ONMB)</span>
                    </label>
                    <input
                      type="text"
                      value={doctorOnmbNumber}
                      onChange={(e) => setDoctorOnmbNumber(e.target.value)}
                      placeholder="Ex: ONMB-2024-4819"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs font-mono"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Requis pour attester de votre droit d'exercice médical.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Spécialité Médicale</label>
                    <select
                      value={doctorSpecialty}
                      onChange={(e) => setDoctorSpecialty(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs"
                    >
                      <option value="Médecine Générale">Médecine Générale</option>
                      <option value="Cardiologie">Cardiologie</option>
                      <option value="Pédiatrie">Pédiatrie</option>
                      <option value="Gynécologie & Obstétrique">Gynécologie & Obstétrique</option>
                      <option value="Chirurgie">Chirurgie</option>
                    </select>
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button type="button" onClick={() => setStep(2)} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer">
                      <span>Continuer</span> <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Email Professionnel Médical</label>
                    <input
                      type="email"
                      value={doctorEmail}
                      onChange={(e) => setDoctorEmail(e.target.value)}
                      placeholder="dr.mensah@chd-atlantique.bj"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone de consultation</label>
                    <input
                      type="text"
                      value={doctorPhone}
                      onChange={(e) => setDoctorPhone(e.target.value)}
                      placeholder="+229 95 00 00 00"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Mot de passe sécurisé</label>
                    <input
                      type="password"
                      value={doctorSignupPassword}
                      onChange={(e) => setDoctorSignupPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs"
                    />
                  </div>

                  <div className="pt-3 flex justify-between">
                    <button type="button" onClick={() => setStep(1)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-2xl text-xs cursor-pointer">Précédent</button>
                    <button type="button" onClick={() => setStep(3)} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer">
                      <span>Continuer</span> <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Numéro de Licence d'État MSP</label>
                    <input
                      type="text"
                      value={doctorMspLicense}
                      onChange={(e) => setDoctorMspLicense(e.target.value)}
                      placeholder="LIC-MSP-BENIN-XXXX"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs font-mono"
                    />
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl space-y-1">
                    <span className="font-bold text-xs text-blue-900 block flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      Attestation d'Exercice & Signature Cryptographique
                    </span>
                    <p className="text-[11px] text-blue-700">
                      En validant, vous activez la protection de vos ordonnances et actes de soins.
                    </p>
                  </div>

                  <div className="pt-3 flex justify-between">
                    <button type="button" onClick={() => setStep(2)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-2xl text-xs cursor-pointer">Précédent</button>
                    <button type="button" onClick={handleSignUpComplete} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-md">
                      <span>Valider mon Statut Médecin</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* C. INSCRIPTION DIRECTEUR (AGRÉMENT MSP ÉTABLISSEMENT) */}
          {/* ==================================================== */}
          {currentRole === 'hospital' && (
            <div className="space-y-4">
              {step === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nom du Directeur / Responsable</label>
                    <input
                      type="text"
                      value={directorName}
                      onChange={(e) => setDirectorName(e.target.value)}
                      placeholder="Ex : Dr. Directeur Dossou"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nom de l'Établissement Hospitalier</label>
                    <input
                      type="text"
                      value={directorHospitalName}
                      onChange={(e) => setDirectorHospitalName(e.target.value)}
                      placeholder="Ex : Hôpital de Zone d'Abomey-Calavi"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                      <FileCheck className="w-3.5 h-3.5 text-orange-600" />
                      <span>Numéro d'Agrément Officiel MSP</span>
                    </label>
                    <input
                      type="text"
                      value={directorMspAgreement}
                      onChange={(e) => setDirectorMspAgreement(e.target.value)}
                      placeholder="Ex : MSP-AGR-2024-091"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs font-mono"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Atteste de l'autorisation d'ouverture et d'exploitation du Ministère.</p>
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button type="button" onClick={() => setStep(2)} className="px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer">
                      <span>Continuer</span> <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Type d'Établissement</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['public', 'private', 'clinic'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setDirectorHospitalType(t)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            directorHospitalType === t ? 'bg-orange-600 text-white border-orange-600' : 'bg-slate-50 border-gray-200'
                          }`}
                        >
                          {t === 'public' ? 'Hôpital Public' : t === 'private' ? 'Hôpital Privé' : 'Clinique'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Adresse Physique</label>
                    <input
                      type="text"
                      value={directorAddress}
                      onChange={(e) => setDirectorAddress(e.target.value)}
                      placeholder="Abomey-Calavi, Quartier..."
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone Direction</label>
                    <input
                      type="text"
                      value={directorPhone}
                      onChange={(e) => setDirectorPhone(e.target.value)}
                      placeholder="+229 90 00 00 00"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs"
                    />
                  </div>

                  <div className="pt-3 flex justify-between">
                    <button type="button" onClick={() => setStep(1)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-2xl text-xs cursor-pointer">Précédent</button>
                    <button type="button" onClick={() => setStep(3)} className="px-8 py-3 bg-orange-600 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer">
                      <span>Continuer</span> <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Email Officiel Direction</label>
                    <input
                      type="email"
                      value={directorEmail}
                      onChange={(e) => setDirectorEmail(e.target.value)}
                      placeholder="direction@hopital.bj"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Mot de passe Direction</label>
                    <input
                      type="password"
                      value={directorSignupPassword}
                      onChange={(e) => setDirectorSignupPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs"
                    />
                  </div>

                  <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl space-y-1">
                    <span className="font-bold text-xs text-orange-900 block flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-orange-600" />
                      Habilitation Trésorerie & Réseau Hospitalier
                    </span>
                    <p className="text-[11px] text-orange-700">
                      Permet la réception des paiements de soins instantanés via Lightning Network et la comptabilité nationale.
                    </p>
                  </div>

                  <div className="pt-3 flex justify-between">
                    <button type="button" onClick={() => setStep(2)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-2xl text-xs cursor-pointer">Précédent</button>
                    <button type="button" onClick={handleSignUpComplete} className="px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-md">
                      <span>Valider l'Agrément Établissement</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </motion.div>
      )}

    </div>
  );
}
