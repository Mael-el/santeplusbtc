import React, { useState, useRef } from 'react';
import { Patient, HospitalUser, Hospital } from '../types';
import { HOSPITALS } from '../data';
import { 
  Phone, Lock, Eye, EyeOff, Fingerprint, 
  ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck, Mail, 
  Info, Building2, User, Stethoscope, Award, FileCheck,
  AlertCircle, CheckCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import SanteLogo from './SanteLogo';

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
  // Screen mode: 'signin', 'signup' or 'forgot'
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');

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
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});
  // Tracks which fields the user has touched (typed or blurred)
  const touchedFields = useRef<Set<string>>(new Set());

  // Multi-Step Registration Wizard fields (Steps 1, 2, 3)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Patient Registration fields
  const [patientLastName, setPatientLastName] = useState('');
  const [patientFirstName, setPatientFirstName] = useState('');
  const [patientNpi, setPatientNpi] = useState('');
  const [patientDateOfBirth, setPatientDateOfBirth] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [signupPatientPhone, setSignupPatientPhone] = useState('');
  const [signupPatientEmail, setSignupPatientEmail] = useState('');
  const [patientSignupPassword, setPatientSignupPassword] = useState('');
  const [patientSignupPasswordConfirmation, setPatientSignupPasswordConfirmation] = useState('');
  const [emergencyContactOneName, setEmergencyContactOneName] = useState('');
  const [emergencyContactOnePhone, setEmergencyContactOnePhone] = useState('');
  const [emergencyContactTwoName, setEmergencyContactTwoName] = useState('');
  const [emergencyContactTwoPhone, setEmergencyContactTwoPhone] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergies, setAllergies] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetCodeSent, setResetCodeSent] = useState(false);

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

  const setSignupFieldError = (field: string, message: string) => {
    setSignupErrors(current => {
      if (!message && !current[field]) return current;
      const next = { ...current };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  };

  /** Mark field as touched so success state becomes visible */
  const touchField = (field: string) => {
    touchedFields.current.add(field);
  };

  const validateSignupField = (field: string, value: string, label: string, options: { required?: boolean; email?: boolean; phone?: boolean; password?: boolean; date?: boolean; minLength?: number } = {}) => {
    touchField(field);
    const trimmedValue = value.trim();
    if (options.required && !trimmedValue) {
      setSignupFieldError(field, `${label} est obligatoire.`);
      return false;
    }
    if (!trimmedValue && !options.required) {
      setSignupFieldError(field, '');
      return true;
    }
    if (options.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
      setSignupFieldError(field, 'Saisissez une adresse email valide (ex: vous@exemple.com).');
      return false;
    }
    if (options.phone && !/^(?:\+229[\s.-]?)?(?:01\d{8}|\d{10})$/.test(trimmedValue.replace(/\s/g, ''))) {
      setSignupFieldError(field, 'Numéro béninois invalide. Format attendu: +229 01 97 00 00 00 (10 chiffres).');
      return false;
    }
    if (options.password && value.length < 8) {
      setSignupFieldError(field, 'Le mot de passe doit contenir au moins 8 caractères.');
      return false;
    }
    if (options.minLength && trimmedValue.length < options.minLength) {
      setSignupFieldError(field, `${label} doit contenir au moins ${options.minLength} caractères.`);
      return false;
    }
    if (options.date && new Date(`${value}T00:00:00`) > new Date()) {
      setSignupFieldError(field, 'La date de naissance ne peut pas être dans le futur.');
      return false;
    }
    setSignupFieldError(field, '');
    return true;
  };

  /**
   * Returns the CSS class string to apply to the input/select element.
   * - field-error : red border + red bg   (when there is a validation error)
   * - field-success: green border + green bg (when field is touched & valid)
   * - empty string  : neutral state (not yet touched)
   */
  const getFieldClass = (field: string): string => {
    if (signupErrors[field]) return 'field-error';
    if (touchedFields.current.has(field) && !signupErrors[field]) return 'field-success';
    return '';
  };

  /**
   * Renders the feedback row beneath a form field.
   * Shows an animated error message with AlertCircle icon, or a
   * subtle success check when the field is touched and valid.
   */
  const renderFieldFeedback = (field: string, successLabel?: string) => {
    if (signupErrors[field]) {
      return (
        <p className="field-error-msg" role="alert" aria-live="polite">
          <AlertCircle aria-hidden="true" />
          <span>{signupErrors[field]}</span>
        </p>
      );
    }
    if (touchedFields.current.has(field) && successLabel) {
      return (
        <p className="field-success-msg">
          <CheckCheck aria-hidden="true" />
          <span>{successLabel}</span>
        </p>
      );
    }
    return null;
  };

  /**
   * Encapsule un champ input dans un wrapper relatif avec affichage immédiat
   * de l'icône d'alerte (erreur) ou de la coche de confirmation (succès)
   */
  const renderFieldWithIcon = (field: string, inputElement: React.ReactNode) => (
    <div className="field-wrapper">
      {inputElement}
      {signupErrors[field] ? (
        <AlertCircle className="field-alert-icon" aria-hidden="true" />
      ) : touchedFields.current.has(field) ? (
        <CheckCheck className="field-valid-icon" aria-hidden="true" />
      ) : null}
    </div>
  );

  // Keep old name as alias so existing call-sites work during migration
  const showSignupError = renderFieldFeedback;
  const inputWithError = (field: string) => getFieldClass(field);

  const applyRegistrationServerError = (message: string, role: 'patient' | 'doctor' | 'hospital') => {
    const normalized = message.toLowerCase();
    const field = normalized.includes('email') ? role === 'patient' ? 'signupPatientEmail' : role === 'doctor' ? 'doctorEmail' : 'directorEmail'
      : normalized.includes('téléphone') || normalized.includes('phone') ? role === 'patient' ? 'signupPatientPhone' : role === 'doctor' ? 'doctorPhone' : 'directorPhone'
      : normalized.includes('agrément') || normalized.includes('agreement') ? 'directorMspAgreement'
      : normalized.includes('onmb') ? 'doctorOnmbNumber'
      : '';
    if (field) setSignupFieldError(field, message);
  };

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
            password,
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
          email: user.email || '',
          phone: user.phone || patientPhone,
          walletBalance: user.walletBalance || 0,
          satoshiBalance: user.satoshiBalance || 0,
          npi: user.npi || 'BJ-CITOYEN',
          qrCodeHash: user.qrCodeHash,
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
        localStorage.setItem('sante_hospital_token', data.token);
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

  const handlePasswordResetRequest = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!/^\S+@\S+\.\S+$/.test(resetEmail.trim())) {
      setErrorMsg('Saisissez une adresse email valide.');
      return;
    }
    try {
      const res = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Impossible de demander la réinitialisation.');
        return;
      }
      setResetCodeSent(true);
      setSuccessMsg(data.devCode
        ? `Code de test local : ${data.devCode}`
        : 'Si cette adresse existe, un code a été envoyé par email.');
    } catch {
      setErrorMsg('Impossible de joindre le service de récupération.');
    }
  };

  const handlePasswordResetConfirm = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!resetCode.trim() || resetPassword.length < 8) {
      setErrorMsg('Saisissez le code reçu et un mot de passe d’au moins 8 caractères.');
      return;
    }
    try {
      const res = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim(), code: resetCode.trim(), newPassword: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Code invalide ou expiré.');
        return;
      }
      setSuccessMsg(data.message);
      setAuthMode('signin');
      setPassword('');
    } catch {
      setErrorMsg('Impossible de joindre le service de récupération.');
    }
  };

  // Registration Complete Handler (Création réelle dans la base de données)
  const handleSignUpComplete = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (currentRole === 'patient') {
      const valid = validatePatientIdentity() && validatePatientSecurity() && validatePatientContacts();
      if (!valid) {
        setErrorMsg('Corrigez les champs signalés avant de créer votre dossier.');
        return;
      }

      try {
        const res = await fetch('/api/auth/register/patient', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: signupPatientEmail.trim(),
            phone: signupPatientPhone,
            password: patientSignupPassword,
            firstName: patientFirstName.trim(),
            lastName: patientLastName.trim(),
            dateOfBirth: patientDateOfBirth,
            gender: patientGender,
            bloodType: bloodGroup || undefined,
            allergies: allergies || undefined,
            emergencyContacts: [
              { name: emergencyContactOneName.trim(), phone: emergencyContactOnePhone.trim() },
              { name: emergencyContactTwoName.trim(), phone: emergencyContactTwoPhone.trim() },
            ],
          })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          const message = data.error || "Erreur lors de la création du compte patient.";
          applyRegistrationServerError(message, 'patient');
          setErrorMsg(message);
          return;
        }

        const fullName = `${patientFirstName.trim()} ${patientLastName.trim()}`;
        const registeredUserId = data.data?.user?.id;
        const newPatient: Patient = {
          name: fullName,
          email: signupPatientEmail.trim(),
          phone: signupPatientPhone,
          npi: data.data?.user?.npi || patientNpi || (registeredUserId
            ? `BJ${String(registeredUserId).padStart(11, '0')}`
            : 'BJ-CITOYEN'),
          qrCodeHash: data.data?.user?.qrCodeHash,
          walletBalance: 0,
          satoshiBalance: 0,
          bloodGroup: bloodGroup,
          allergies: allergies || 'Aucune',
          dateOfBirth: patientDateOfBirth,
          gender: patientGender,
          emergencyContacts: [
            { name: emergencyContactOneName.trim(), phone: emergencyContactOnePhone.trim() },
            { name: emergencyContactTwoName.trim(), phone: emergencyContactTwoPhone.trim() },
          ]
        };
        setSuccessMsg(`Dossier citoyen créé avec succès ! Bienvenue ${fullName}.`);
        speakInstruction(`Votre dossier médical est créé avec succès.`);
        setTimeout(() => onPatientLogin(newPatient), 800);
      } catch (err) {
        setErrorMsg("Erreur réseau lors de l'inscription.");
      }

    } else if (currentRole === 'doctor') {
      const valid = validateDoctorIdentity() && validateDoctorSecurity() && validateDoctorAttestation();
      if (!valid) {
        setErrorMsg('Corrigez les champs signalés avant de valider votre inscription.');
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
          const message = data.error || "Erreur lors de l'enregistrement du praticien.";
          applyRegistrationServerError(message, 'doctor');
          setErrorMsg(message);
          return;
        }

        const docFullName = doctorName.trim().startsWith('Dr.') ? doctorName.trim() : `Dr. ${doctorName.trim()}`;
        const newDoctor: HospitalUser = {
          email: doctorEmail,
          hospitalId: doctorHospitalId,
          role: 'doctor',
          name: docFullName,
          token: data.token || data.data?.accessToken
        };
        if (newDoctor.token) localStorage.setItem('sante_hospital_token', newDoctor.token);
        setSuccessMsg(`Compte Médecin attesté créé avec succès ! Bienvenue ${docFullName}.`);
        speakInstruction(`Compte médecin validé.`);
        setTimeout(() => onHospitalLogin(newDoctor), 800);
      } catch (err) {
        setErrorMsg("Erreur réseau lors de l'inscription praticien.");
      }

    } else {
      const valid = validateDirectorIdentity() && validateDirectorDetails() && validateDirectorSecurity();
      if (!valid) {
        setErrorMsg("Corrigez les champs signalés avant d'enregistrer l'établissement.");
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
          const message = data.error || "Erreur lors de l'enregistrement de l'établissement.";
          applyRegistrationServerError(message, 'hospital');
          setErrorMsg(message);
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

  const validatePatientIdentity = () => [
    validateSignupField('patientLastName', patientLastName, 'Le nom', { required: true, minLength: 2 }),
    validateSignupField('patientFirstName', patientFirstName, 'Le prénom', { required: true, minLength: 2 }),
    validateSignupField('patientDateOfBirth', patientDateOfBirth, 'La date de naissance', { required: true, date: true }),
    validateSignupField('patientGender', patientGender, 'Le sexe', { required: true }),
  ].every(Boolean);

  const validatePatientSecurity = () => [
    validateSignupField('signupPatientEmail', signupPatientEmail, "L'email", { required: true, email: true }),
    validateSignupField('signupPatientPhone', signupPatientPhone, 'Le téléphone', { required: true, phone: true }),
    validateSignupField('patientSignupPassword', patientSignupPassword, 'Le mot de passe', { required: true, password: true }),
    validateSignupField('patientSignupPasswordConfirmation', patientSignupPasswordConfirmation, 'La confirmation', { required: true }),
  ].every(Boolean) && (() => {
    const valid = patientSignupPassword === patientSignupPasswordConfirmation;
    setSignupFieldError('patientSignupPasswordConfirmation', valid ? '' : 'Les deux mots de passe ne correspondent pas.');
    return valid;
  })();

  const validatePatientContacts = () => [
    validateSignupField('emergencyContactOneName', emergencyContactOneName, 'Le nom du contact 1', { required: true }),
    validateSignupField('emergencyContactOnePhone', emergencyContactOnePhone, 'Le téléphone du contact 1', { required: true, phone: true }),
    validateSignupField('emergencyContactTwoName', emergencyContactTwoName, 'Le nom du contact 2', { required: true }),
    validateSignupField('emergencyContactTwoPhone', emergencyContactTwoPhone, 'Le téléphone du contact 2', { required: true, phone: true }),
  ].every(Boolean);

  const validateDoctorIdentity = () => [
    validateSignupField('doctorName', doctorName, 'Le nom du praticien', { required: true, minLength: 2 }),
    validateSignupField('doctorOnmbNumber', doctorOnmbNumber, "Le numéro ONMB", { required: true, minLength: 4 }),
  ].every(Boolean);

  const validateDoctorSecurity = () => [
    validateSignupField('doctorEmail', doctorEmail, "L'email professionnel", { required: true, email: true }),
    validateSignupField('doctorPhone', doctorPhone, 'Le téléphone', { required: true, phone: true }),
    validateSignupField('doctorSignupPassword', doctorSignupPassword, 'Le mot de passe', { required: true, password: true }),
  ].every(Boolean);

  const validateDoctorAttestation = () => validateSignupField('doctorMspLicense', doctorMspLicense, 'La licence MSP', { required: true, minLength: 4 });

  const validateDirectorIdentity = () => [
    validateSignupField('directorName', directorName, 'Le nom du responsable', { required: true, minLength: 2 }),
    validateSignupField('directorHospitalName', directorHospitalName, "Le nom de l'établissement", { required: true, minLength: 3 }),
    validateSignupField('directorMspAgreement', directorMspAgreement, "L'agrément MSP", { required: true, minLength: 4 }),
  ].every(Boolean);

  const validateDirectorDetails = () => [
    validateSignupField('directorAddress', directorAddress, "L'adresse", { required: true, minLength: 3 }),
    validateSignupField('directorPhone', directorPhone, 'Le téléphone', { required: true, phone: true }),
  ].every(Boolean);

  const validateDirectorSecurity = () => [
    validateSignupField('directorEmail', directorEmail, "L'email officiel", { required: true, email: true }),
    validateSignupField('directorSignupPassword', directorSignupPassword, 'Le mot de passe', { required: true, password: true }),
  ].every(Boolean);

  const continuePatientSecurityStep = () => {
    setErrorMsg('');
    if (!validatePatientIdentity() || !validatePatientSecurity() || !validatePatientContacts()) {
      setErrorMsg('Corrigez les champs signalés avant de continuer.');
      return;
    }
    setStep(3);
  };

  const calculateAge = (dateOfBirth: string) => {
    if (!dateOfBirth) return '';
    const today = new Date();
    const birthDate = new Date(`${dateOfBirth}T00:00:00`);
    let age = today.getFullYear() - birthDate.getFullYear();
    const birthdayHasPassed = today.getMonth() > birthDate.getMonth()
      || (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
    if (!birthdayHasPassed) age -= 1;
    return age >= 0 ? String(age) : '';
  };

  return (
    <div className="auth-shell w-full flex flex-col items-center justify-center p-4 sm:p-6">
      {errorMsg && (
        <div className="w-full max-w-lg mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-sans">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="w-full max-w-lg mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-sans flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      
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
            <SanteLogo size="lg" showSubtitle={false} className="justify-center" />
          </div>

          {/* Formulaire de Connexion Strictement Dédié */}
          <form onSubmit={handleSignInSubmit} className="space-y-4">
            
            {/* Champ Identifiant Spécifique */}
            <div>
              <label className="block text-xs font-bold text-gray-700 font-sans mb-1.5">
                {currentRole === 'patient' && "Email ou numéro de téléphone"}
                {currentRole === 'doctor' && "Email professionnel du médecin"}
                {currentRole === 'hospital' && "Email professionnel de l'hôpital"}
              </label>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  {currentRole === 'patient' ? <Mail className="w-4 h-4" /> : currentRole === 'doctor' ? <Stethoscope className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                </div>

                {currentRole === 'patient' && (
                  <input
                    type="text"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    placeholder="email@exemple.com ou +229 01 00 00 00 00"
                    required
                    className="w-full pl-10 pr-3 py-3 bg-white border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans focus:outline-none focus:border-emerald-500"
                  />
                )}

                {currentRole === 'doctor' && (
                  <input
                    type="text"
                    value={doctorIdentifier}
                    onChange={(e) => setDoctorIdentifier(e.target.value)}
                    placeholder="medecin@hopital.bj"
                    required
                    className="w-full pl-10 pr-3 py-3 bg-white border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans focus:outline-none focus:border-emerald-500"
                  />
                )}

                {currentRole === 'hospital' && (
                  <input
                    type="text"
                    value={directorIdentifier}
                    onChange={(e) => setDirectorIdentifier(e.target.value)}
                    placeholder="direction@hopital.bj"
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
                  onClick={() => { setResetEmail(patientPhone.includes('@') ? patientPhone : ''); setErrorMsg(''); setSuccessMsg(''); setResetCodeSent(false); setAuthMode('forgot'); }}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </div>

            {/* Bouton de Connexion (Image 2) */}
            <button
              type="submit"
              className="w-full py-3.5 btn-primary text-white font-bold rounded-2xl text-sm transition-all cursor-pointer shadow-md"
            >
              Se connecter
            </button>

            {/* Séparateur */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="border-t border-[#d0e8db] w-full"></div>
              <span className="bg-white px-3 text-[11px] text-[#6d877c] font-sans font-medium absolute">
                Ou connectez-vous avec
              </span>
            </div>

            {/* Bouton Biométrie (Face ID / Empreinte) */}
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={isBiometricScanning}
              className="w-full py-3.5 btn-secondary font-bold rounded-2xl text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Fingerprint className={`w-5 h-5 text-emerald-600 ${isBiometricScanning ? 'animate-pulse' : ''}`} />
              <span>{isBiometricScanning ? 'Scan biométrique...' : 'Biométrie (Face ID / Empreinte)'}</span>
            </button>

          </form>

          {currentRole === 'doctor' && (
            <div className="auth-demo-account mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-cyan-950">Compte médecin de démonstration</p>
                  <p className="mt-1 text-[11px] text-cyan-800">medecin.demo@santeplus.bj</p>
                  <p className="text-[11px] text-cyan-800">MedecinDemo2026!</p>
                </div>
                <Stethoscope className="h-5 w-5 shrink-0 text-cyan-700" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setDoctorIdentifier('medecin.demo@santeplus.bj');
                  setPassword('MedecinDemo2026!');
                  setErrorMsg('');
                }}
                className="mt-3 w-full rounded-xl border border-cyan-300 bg-white px-3 py-2 text-xs font-bold text-cyan-900 transition hover:bg-cyan-100"
              >
                Utiliser ce compte
              </button>
            </div>
          )}

          {currentRole === 'hospital' && (
            <div className="auth-demo-account mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-orange-950">Compte hôpital de démonstration</p>
                  <p className="mt-1 text-[11px] text-orange-800">hopital.demo@santeplus.bj</p>
                  <p className="text-[11px] text-orange-800">HopitalDemo2026!</p>
                </div>
                <Building2 className="h-5 w-5 shrink-0 text-orange-700" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setDirectorIdentifier('hopital.demo@santeplus.bj');
                  setPassword('HopitalDemo2026!');
                  setErrorMsg('');
                }}
                className="mt-3 w-full rounded-xl border border-orange-300 bg-white px-3 py-2 text-xs font-bold text-orange-900 transition hover:bg-orange-100"
              >
                Utiliser ce compte
              </button>
            </div>
          )}

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

      {authMode === 'forgot' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden p-6 sm:p-8"
        >
          <button type="button" onClick={() => { setAuthMode('signin'); setErrorMsg(''); setSuccessMsg(''); }} className="mb-6 flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-800">
            <ArrowLeft className="h-4 w-4" /> Retour à la connexion
          </button>
          <div className="mb-6 text-center">
            <Mail className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
            <h2 className="text-xl font-black text-gray-900">Mot de passe oublié</h2>
            <p className="mt-1 text-xs text-gray-500">Recevez un code sur l’email associé à votre espace patient.</p>
          </div>
          <div className="space-y-4">
            <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="vous@exemple.com" className="w-full rounded-2xl border border-gray-200 px-3.5 py-3 text-sm" />
            <button type="button" onClick={handlePasswordResetRequest} className="w-full rounded-2xl bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-700">Envoyer le code</button>
            {resetCodeSent && (
              <>
                <input type="text" inputMode="numeric" value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Code à 6 chiffres" className="w-full rounded-2xl border border-gray-200 px-3.5 py-3 text-sm" />
                <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Nouveau mot de passe" className="w-full rounded-2xl border border-gray-200 px-3.5 py-3 text-sm" />
                <button type="button" onClick={handlePasswordResetConfirm} className="w-full rounded-2xl border border-emerald-600 py-3.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50">Réinitialiser le mot de passe</button>
              </>
            )}
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
              <SanteLogo size="md" showSubtitle={false} />
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
                      {renderFieldWithIcon(
                        'patientLastName',
                        <input
                          type="text"
                          value={patientLastName}
                          onChange={(e) => { setPatientLastName(e.target.value); validateSignupField('patientLastName', e.target.value, 'Le nom', { required: true, minLength: 2 }); }}
                          onBlur={() => validateSignupField('patientLastName', patientLastName, 'Le nom', { required: true, minLength: 2 })}
                          placeholder="Ex: Dupont"
                          className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans pr-10 ${inputWithError('patientLastName')}`}
                        />
                      )}
                      {showSignupError('patientLastName', 'Nom enregistré.')}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Prénom(s)</label>
                      {renderFieldWithIcon(
                        'patientFirstName',
                        <input
                          type="text"
                          value={patientFirstName}
                          onChange={(e) => { setPatientFirstName(e.target.value); validateSignupField('patientFirstName', e.target.value, 'Le prénom', { required: true, minLength: 2 }); }}
                          onBlur={() => validateSignupField('patientFirstName', patientFirstName, 'Le prénom', { required: true, minLength: 2 })}
                          placeholder="Ex: Jean"
                          className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans pr-10 ${inputWithError('patientFirstName')}`}
                        />
                      )}
                      {showSignupError('patientFirstName', 'Prénom enregistré.')}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Date de naissance</label>
                      <input type="date" value={patientDateOfBirth} onChange={(e) => { setPatientDateOfBirth(e.target.value); validateSignupField('patientDateOfBirth', e.target.value, 'La date de naissance', { required: true, date: true }); }} onBlur={() => validateSignupField('patientDateOfBirth', patientDateOfBirth, 'La date de naissance', { required: true, date: true })} max={new Date().toISOString().split('T')[0]} className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm ${inputWithError('patientDateOfBirth')}`} />
                      {showSignupError('patientDateOfBirth')}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Âge</label>
                      <input type="text" value={calculateAge(patientDateOfBirth)} readOnly placeholder="Calculé automatiquement" className="w-full px-3.5 py-2.5 border border-gray-200 bg-gray-50 rounded-2xl text-xs sm:text-sm" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Sexe</label>
                    <select value={patientGender} onChange={(e) => { setPatientGender(e.target.value); validateSignupField('patientGender', e.target.value, 'Le sexe', { required: true }); }} onBlur={() => validateSignupField('patientGender', patientGender, 'Le sexe', { required: true })} className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm ${inputWithError('patientGender')}`}>
                      <option value="">Sélectionner</option>
                      <option value="femme">Femme</option>
                      <option value="homme">Homme</option>
                      <option value="autre">Autre</option>
                      <option value="non_specifie">Je préfère ne pas préciser</option>
                    </select>
                    {showSignupError('patientGender')}
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        if (validatePatientIdentity()) setStep(2);
                        else setErrorMsg('Corrigez les champs signalés avant de continuer.');
                      }}
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
                    <label className="block text-xs font-bold text-gray-700 mb-1">Adresse email personnelle</label>
                    {renderFieldWithIcon(
                      'signupPatientEmail',
                      <input
                        type="email"
                        value={signupPatientEmail}
                        onChange={(e) => { setSignupPatientEmail(e.target.value); validateSignupField('signupPatientEmail', e.target.value, "L'email", { required: true, email: true }); }}
                        onBlur={() => validateSignupField('signupPatientEmail', signupPatientEmail, "L'email", { required: true, email: true })}
                        placeholder="vous@exemple.com"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm pr-10 ${inputWithError('signupPatientEmail')}`}
                      />
                    )}
                    {showSignupError('signupPatientEmail', 'Adresse email valide.')}
                    <p className="mt-1 text-[11px] text-gray-500">Utilisé pour vous identifier et récupérer votre mot de passe.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Numéro de téléphone mobile</label>
                    {renderFieldWithIcon(
                      'signupPatientPhone',
                      <input
                        type="tel"
                        value={signupPatientPhone}
                        onChange={(e) => { setSignupPatientPhone(e.target.value); validateSignupField('signupPatientPhone', e.target.value, 'Le téléphone', { required: true, phone: true }); }}
                        onBlur={() => validateSignupField('signupPatientPhone', signupPatientPhone, 'Le téléphone', { required: true, phone: true })}
                        placeholder="+229 01 97 00 00 00"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm pr-10 ${inputWithError('signupPatientPhone')}`}
                      />
                    )}
                    {showSignupError('signupPatientPhone', 'Numéro vérifié (10 chiffres).')}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Mot de passe (8 caractères minimum)</label>
                    {renderFieldWithIcon(
                      'patientSignupPassword',
                      <input
                        type="password"
                        value={patientSignupPassword}
                        onChange={(e) => {
                          setPatientSignupPassword(e.target.value);
                          validateSignupField('patientSignupPassword', e.target.value, 'Le mot de passe', { required: true, password: true });
                          if (patientSignupPasswordConfirmation) {
                            setSignupFieldError(
                              'patientSignupPasswordConfirmation',
                              patientSignupPasswordConfirmation === e.target.value ? '' : 'Les deux mots de passe ne correspondent pas.'
                            );
                          }
                        }}
                        onBlur={() => validateSignupField('patientSignupPassword', patientSignupPassword, 'Le mot de passe', { required: true, password: true })}
                        placeholder="SantePlus2026"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm pr-10 ${inputWithError('patientSignupPassword')}`}
                      />
                    )}
                    {showSignupError('patientSignupPassword', 'Mot de passe sécurisé.')}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Confirmer le mot de passe</label>
                    {renderFieldWithIcon(
                      'patientSignupPasswordConfirmation',
                      <input
                        type="password"
                        value={patientSignupPasswordConfirmation}
                        onChange={(e) => {
                          setPatientSignupPasswordConfirmation(e.target.value);
                          touchField('patientSignupPasswordConfirmation');
                          setSignupFieldError(
                            'patientSignupPasswordConfirmation',
                            e.target.value === patientSignupPassword ? '' : 'Les deux mots de passe ne correspondent pas.'
                          );
                        }}
                        onBlur={() => {
                          touchField('patientSignupPasswordConfirmation');
                          if (!patientSignupPasswordConfirmation) {
                            setSignupFieldError('patientSignupPasswordConfirmation', 'La confirmation du mot de passe est obligatoire.');
                          } else if (patientSignupPasswordConfirmation !== patientSignupPassword) {
                            setSignupFieldError('patientSignupPasswordConfirmation', 'Les deux mots de passe ne correspondent pas.');
                          } else {
                            setSignupFieldError('patientSignupPasswordConfirmation', '');
                          }
                        }}
                        placeholder="Répétez votre mot de passe"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm pr-10 ${inputWithError('patientSignupPasswordConfirmation')}`}
                      />
                    )}
                    {showSignupError('patientSignupPasswordConfirmation', 'Les mots de passe correspondent.')}
                  </div>

                  <div className="border-t border-gray-100 pt-3 space-y-3">
                    <p className="text-xs font-black text-gray-800">Contacts d'urgence</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        {renderFieldWithIcon(
                          'emergencyContactOneName',
                          <input type="text" value={emergencyContactOneName} onChange={(e) => { setEmergencyContactOneName(e.target.value); validateSignupField('emergencyContactOneName', e.target.value, 'Le nom du contact 1', { required: true }); }} onBlur={() => validateSignupField('emergencyContactOneName', emergencyContactOneName, 'Le nom du contact 1', { required: true })} placeholder="Nom du contact 1" className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs pr-10 ${inputWithError('emergencyContactOneName')}`} />
                        )}
                        {showSignupError('emergencyContactOneName')}
                      </div>
                      <div>
                        {renderFieldWithIcon(
                          'emergencyContactOnePhone',
                          <input type="tel" value={emergencyContactOnePhone} onChange={(e) => { setEmergencyContactOnePhone(e.target.value); validateSignupField('emergencyContactOnePhone', e.target.value, 'Le téléphone du contact 1', { required: true, phone: true }); }} onBlur={() => validateSignupField('emergencyContactOnePhone', emergencyContactOnePhone, 'Le téléphone du contact 1', { required: true, phone: true })} placeholder="Téléphone du contact 1" className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs pr-10 ${inputWithError('emergencyContactOnePhone')}`} />
                        )}
                        {showSignupError('emergencyContactOnePhone')}
                      </div>
                      <div>
                        {renderFieldWithIcon(
                          'emergencyContactTwoName',
                          <input type="text" value={emergencyContactTwoName} onChange={(e) => { setEmergencyContactTwoName(e.target.value); validateSignupField('emergencyContactTwoName', e.target.value, 'Le nom du contact 2', { required: true }); }} onBlur={() => validateSignupField('emergencyContactTwoName', emergencyContactTwoName, 'Le nom du contact 2', { required: true })} placeholder="Nom du contact 2" className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs pr-10 ${inputWithError('emergencyContactTwoName')}`} />
                        )}
                        {showSignupError('emergencyContactTwoName')}
                      </div>
                      <div>
                        {renderFieldWithIcon(
                          'emergencyContactTwoPhone',
                          <input type="tel" value={emergencyContactTwoPhone} onChange={(e) => { setEmergencyContactTwoPhone(e.target.value); validateSignupField('emergencyContactTwoPhone', e.target.value, 'Le téléphone du contact 2', { required: true, phone: true }); }} onBlur={() => validateSignupField('emergencyContactTwoPhone', emergencyContactTwoPhone, 'Le téléphone du contact 2', { required: true, phone: true })} placeholder="Téléphone du contact 2" className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs pr-10 ${inputWithError('emergencyContactTwoPhone')}`} />
                        )}
                        {showSignupError('emergencyContactTwoPhone')}
                      </div>
                    </div>
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
                    {renderFieldWithIcon(
                      'doctorName',
                      <input
                        type="text"
                        value={doctorName}
                        onChange={(e) => { setDoctorName(e.target.value); validateSignupField('doctorName', e.target.value, 'Le nom du praticien', { required: true, minLength: 2 }); }}
                        onBlur={() => validateSignupField('doctorName', doctorName, 'Le nom du praticien', { required: true, minLength: 2 })}
                        placeholder="Ex: Dr. Mensah Paul"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm pr-10 ${inputWithError('doctorName')}`}
                      />
                    )}
                    {showSignupError('doctorName')}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-blue-600" />
                      <span>Numéro d'Ordre National des Médecins (ONMB)</span>
                    </label>
                    {renderFieldWithIcon(
                      'doctorOnmbNumber',
                      <input
                        type="text"
                        value={doctorOnmbNumber}
                        onChange={(e) => { setDoctorOnmbNumber(e.target.value); validateSignupField('doctorOnmbNumber', e.target.value, 'Le numéro ONMB', { required: true, minLength: 4 }); }}
                        onBlur={() => validateSignupField('doctorOnmbNumber', doctorOnmbNumber, 'Le numéro ONMB', { required: true, minLength: 4 })}
                        placeholder="Ex: ONMB-2024-4819"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs font-mono pr-10 ${inputWithError('doctorOnmbNumber')}`}
                      />
                    )}
                    {showSignupError('doctorOnmbNumber') || <p className="text-[11px] text-gray-400 mt-1">Requis pour attester de votre droit d'exercice médical.</p>}
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
                    <button type="button" onClick={() => { setErrorMsg(''); if (validateDoctorIdentity()) setStep(2); else setErrorMsg('Corrigez les champs signalés avant de continuer.'); }} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer">
                      <span>Continuer</span> <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Email Professionnel Médical</label>
                    {renderFieldWithIcon(
                      'doctorEmail',
                      <input
                        type="email"
                        value={doctorEmail}
                        onChange={(e) => { setDoctorEmail(e.target.value); validateSignupField('doctorEmail', e.target.value, "L'email professionnel", { required: true, email: true }); }}
                        onBlur={() => validateSignupField('doctorEmail', doctorEmail, "L'email professionnel", { required: true, email: true })}
                        placeholder="dr.mensah@chd-atlantique.bj"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs pr-10 ${inputWithError('doctorEmail')}`}
                      />
                    )}
                    {showSignupError('doctorEmail')}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone de consultation</label>
                    {renderFieldWithIcon(
                      'doctorPhone',
                      <input
                        type="text"
                        value={doctorPhone}
                        onChange={(e) => { setDoctorPhone(e.target.value); validateSignupField('doctorPhone', e.target.value, 'Le téléphone', { required: true, phone: true }); }}
                        onBlur={() => validateSignupField('doctorPhone', doctorPhone, 'Le téléphone', { required: true, phone: true })}
                        placeholder="+229 01 95 00 00 00"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs pr-10 ${inputWithError('doctorPhone')}`}
                      />
                    )}
                    {showSignupError('doctorPhone')}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Mot de passe sécurisé</label>
                    {renderFieldWithIcon(
                      'doctorSignupPassword',
                      <input
                        type="password"
                        value={doctorSignupPassword}
                        onChange={(e) => { setDoctorSignupPassword(e.target.value); validateSignupField('doctorSignupPassword', e.target.value, 'Le mot de passe', { required: true, password: true }); }}
                        onBlur={() => validateSignupField('doctorSignupPassword', doctorSignupPassword, 'Le mot de passe', { required: true, password: true })}
                        placeholder="••••••••"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs pr-10 ${inputWithError('doctorSignupPassword')}`}
                      />
                    )}
                    {showSignupError('doctorSignupPassword')}
                  </div>

                  <div className="pt-3 flex justify-between">
                    <button type="button" onClick={() => setStep(1)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-2xl text-xs cursor-pointer">Précédent</button>
                    <button type="button" onClick={() => { setErrorMsg(''); if (validateDoctorSecurity()) setStep(3); else setErrorMsg('Corrigez les champs signalés avant de continuer.'); }} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer">
                      <span>Continuer</span> <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Numéro de Licence d'État MSP</label>
                    {renderFieldWithIcon(
                      'doctorMspLicense',
                      <input
                        type="text"
                        value={doctorMspLicense}
                        onChange={(e) => { setDoctorMspLicense(e.target.value); validateSignupField('doctorMspLicense', e.target.value, 'La licence MSP', { required: true, minLength: 4 }); }}
                        onBlur={() => validateSignupField('doctorMspLicense', doctorMspLicense, 'La licence MSP', { required: true, minLength: 4 })}
                        placeholder="LIC-MSP-BENIN-XXXX"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs font-mono pr-10 ${inputWithError('doctorMspLicense')}`}
                      />
                    )}
                    {showSignupError('doctorMspLicense')}
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
                    {renderFieldWithIcon(
                      'directorName',
                      <input
                        type="text"
                        value={directorName}
                        onChange={(e) => { setDirectorName(e.target.value); validateSignupField('directorName', e.target.value, 'Le nom du responsable', { required: true, minLength: 2 }); }}
                        onBlur={() => validateSignupField('directorName', directorName, 'Le nom du responsable', { required: true, minLength: 2 })}
                        placeholder="Ex : Dr. Directeur Dossou"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs pr-10 ${inputWithError('directorName')}`}
                      />
                    )}
                    {showSignupError('directorName')}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nom de l'Établissement Hospitalier</label>
                    {renderFieldWithIcon(
                      'directorHospitalName',
                      <input
                        type="text"
                        value={directorHospitalName}
                        onChange={(e) => { setDirectorHospitalName(e.target.value); validateSignupField('directorHospitalName', e.target.value, "Le nom de l'établissement", { required: true, minLength: 3 }); }}
                        onBlur={() => validateSignupField('directorHospitalName', directorHospitalName, "Le nom de l'établissement", { required: true, minLength: 3 })}
                        placeholder="Ex : Hôpital de Zone d'Abomey-Calavi"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs pr-10 ${inputWithError('directorHospitalName')}`}
                      />
                    )}
                    {showSignupError('directorHospitalName')}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center gap-1">
                      <FileCheck className="w-3.5 h-3.5 text-orange-600" />
                      <span>Numéro d'Agrément Officiel MSP</span>
                    </label>
                    {renderFieldWithIcon(
                      'directorMspAgreement',
                      <input
                        type="text"
                        value={directorMspAgreement}
                        onChange={(e) => { setDirectorMspAgreement(e.target.value); validateSignupField('directorMspAgreement', e.target.value, "L'agrément MSP", { required: true, minLength: 4 }); }}
                        onBlur={() => validateSignupField('directorMspAgreement', directorMspAgreement, "L'agrément MSP", { required: true, minLength: 4 })}
                        placeholder="Ex : MSP-AGR-2024-091"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs font-mono pr-10 ${inputWithError('directorMspAgreement')}`}
                      />
                    )}
                    {showSignupError('directorMspAgreement') || <p className="text-[11px] text-gray-400 mt-1">Atteste de l'autorisation d'ouverture et d'exploitation du Ministère.</p>}
                  </div>

                  <div className="pt-3 flex justify-end">
                    <button type="button" onClick={() => { setErrorMsg(''); if (validateDirectorIdentity()) setStep(2); else setErrorMsg('Corrigez les champs signalés avant de continuer.'); }} className="px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer">
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
                    {renderFieldWithIcon(
                      'directorAddress',
                      <input
                        type="text"
                        value={directorAddress}
                        onChange={(e) => { setDirectorAddress(e.target.value); validateSignupField('directorAddress', e.target.value, "L'adresse", { required: true, minLength: 3 }); }}
                        onBlur={() => validateSignupField('directorAddress', directorAddress, "L'adresse", { required: true, minLength: 3 })}
                        placeholder="Abomey-Calavi, Quartier..."
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs pr-10 ${inputWithError('directorAddress')}`}
                      />
                    )}
                    {showSignupError('directorAddress')}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Téléphone Direction</label>
                    {renderFieldWithIcon(
                      'directorPhone',
                      <input
                        type="text"
                        value={directorPhone}
                        onChange={(e) => { setDirectorPhone(e.target.value); validateSignupField('directorPhone', e.target.value, 'Le téléphone', { required: true, phone: true }); }}
                        onBlur={() => validateSignupField('directorPhone', directorPhone, 'Le téléphone', { required: true, phone: true })}
                        placeholder="+229 01 90 00 00 00"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs pr-10 ${inputWithError('directorPhone')}`}
                      />
                    )}
                    {showSignupError('directorPhone')}
                  </div>

                  <div className="pt-3 flex justify-between">
                    <button type="button" onClick={() => setStep(1)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-2xl text-xs cursor-pointer">Précédent</button>
                    <button type="button" onClick={() => { setErrorMsg(''); if (validateDirectorDetails()) setStep(3); else setErrorMsg('Corrigez les champs signalés avant de continuer.'); }} className="px-8 py-3 bg-orange-600 text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 cursor-pointer">
                      <span>Continuer</span> <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Email Officiel Direction</label>
                    {renderFieldWithIcon(
                      'directorEmail',
                      <input
                        type="email"
                        value={directorEmail}
                        onChange={(e) => { setDirectorEmail(e.target.value); validateSignupField('directorEmail', e.target.value, "L'email officiel", { required: true, email: true }); }}
                        onBlur={() => validateSignupField('directorEmail', directorEmail, "L'email officiel", { required: true, email: true })}
                        placeholder="direction@hopital.bj"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs pr-10 ${inputWithError('directorEmail')}`}
                      />
                    )}
                    {showSignupError('directorEmail')}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Mot de passe Direction</label>
                    {renderFieldWithIcon(
                      'directorSignupPassword',
                      <input
                        type="password"
                        value={directorSignupPassword}
                        onChange={(e) => { setDirectorSignupPassword(e.target.value); validateSignupField('directorSignupPassword', e.target.value, 'Le mot de passe', { required: true, password: true }); }}
                        onBlur={() => validateSignupField('directorSignupPassword', directorSignupPassword, 'Le mot de passe', { required: true, password: true })}
                        placeholder="••••••••"
                        className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs pr-10 ${inputWithError('directorSignupPassword')}`}
                      />
                    )}
                    {showSignupError('directorSignupPassword')}
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
