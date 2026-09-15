import React, { useState } from 'react';
import { Patient } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, User, Phone, ShieldCheck, HeartPulse, 
  Activity, ClipboardList, Check, AlertCircle, Loader2, Bell, Settings,
  Moon, Languages, LockKeyhole, Fingerprint, Users
} from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: Patient | null;
  onUpdatePatient: (updated: Patient) => void;
  isOffline?: boolean;
}

export default function UserProfileModal({ isOpen, onClose, patient, onUpdatePatient, isOffline = false }: UserProfileModalProps) {
  if (!isOpen || !patient) return null;
  const [name, setName] = useState(patient.name || '');
  const [phone, setPhone] = useState(patient.phone || '');
  const [npi, setNpi] = useState(patient.npi || '');
  const [bloodGroup, setBloodGroup] = useState(patient.bloodGroup || '');
  const [recurringDiseases, setRecurringDiseases] = useState(patient.recurringDiseases || '');
  const [antecedents, setAntecedents] = useState(patient.antecedents || '');
  const [allergies, setAllergies] = useState(patient.allergies || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const memberSince = patient.dateOfBirth ? 'Membre Santé+ actif' : 'Membre Santé+ depuis 2026';

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    const offlineUpdatedPatient = {
      ...patient,
      name,
      phone,
      npi,
      bloodGroup,
      recurringDiseases,
      antecedents,
      allergies
    };

    if (isOffline) {
      try {
        // Direct local save to cache
        localStorage.setItem(`sante_cache_patient_profile_${patient.email.toLowerCase().trim()}`, JSON.stringify(offlineUpdatedPatient));
        
        // Also update any other cache representation of this profile if needed
        onUpdatePatient(offlineUpdatedPatient);
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
        }, 3500);
      } catch (err: any) {
        console.error(err);
        setError("Erreur de sauvegarde locale dans le cache.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      const response = await fetch(`/api/wallet/patients/${encodeURIComponent(patient.email)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          phone,
          npi,
          bloodGroup,
          recurringDiseases,
          antecedents,
          allergies
        }),
      });

      if (!response.ok) {
        throw new Error('Impossible de mettre à jour le profil');
      }

      const updatedPatient = await response.json();
      onUpdatePatient(updatedPatient);
      
      // Update cache
      localStorage.setItem(`sante_cache_patient_profile_${patient.email.toLowerCase().trim()}`, JSON.stringify(updatedPatient));

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
      }, 3500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur s'est produite lors de la mise à jour");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="patient-profile-modal fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="bg-white w-full max-w-2xl rounded-[32px_32px_8px_32px] overflow-hidden shadow-2xl border border-emerald-100 flex flex-col max-h-[90vh]"
          id="user-profile-modal"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-emerald-100 bg-emerald-50/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-700 to-emerald-400 text-white shadow-lg pulse-signature">
                <span className="text-lg font-black">{name.substring(0, 2).toUpperCase() || 'SP'}</span>
                <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Mon profil</p>
                <h3 className="text-2xl font-black text-emerald-950 tracking-tight">{name || 'Patient Santé+'}</h3>
                <p className="text-xs text-emerald-700 font-mono mt-0.5">NPI : {npi || 'Non attribué'}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-emerald-700 hover:text-emerald-900 hover:bg-white rounded-xl transition-all cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm sm:grid-cols-4">
              <div><p className="text-[10px] font-bold uppercase text-emerald-600">Téléphone</p><p className="mt-1 truncate text-sm font-bold text-emerald-950">{phone || 'Non renseigné'}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-emerald-600">Email</p><p className="mt-1 truncate text-sm font-bold text-emerald-950">{patient.email || 'Non renseigné'}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-emerald-600">Groupe</p><p className="mt-1 text-sm font-bold text-emerald-950">{bloodGroup || 'Non renseigné'}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-emerald-600">Statut</p><p className="mt-1 text-sm font-bold text-emerald-950">{memberSince}</p></div>
            </div>
            
            {/* Error or Success states */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-800 rounded-2xl flex items-start gap-3 text-xs font-sans">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-4 bg-emerald-500 border border-emerald-600 text-white rounded-2xl flex items-start gap-3 text-xs font-sans animate-bounce shadow-md">
                <Check className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-extrabold text-[13px]">Modifications enregistrées !</p>
                  <p className="opacity-90 mt-0.5">Votre carnet de santé numérique a été mis à jour avec succès sur l'infrastructure d'état.</p>
                </div>
              </div>
            )}

            {/* Section 1: Informations Personnelles d'État */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                <User className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-black uppercase text-gray-700 tracking-wider font-sans">Identité Officielle Citoyenne</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full name */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nom Complet</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nom complet"
                      className="w-full pl-9 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl font-sans text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#059669] focus:bg-white transition-all"
                    />
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Numéro de Téléphone (Bénin)</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: +229 01 97 88 55 44"
                      className="w-full pl-9 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl font-sans text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#059669] focus:bg-white transition-all"
                    />
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>

                {/* NPI (National Patient ID / Numéro Personnel d'Identification) */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Numéro Personnel d'Identification (NPI)</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={npi}
                      onChange={(e) => setNpi(e.target.value)}
                      placeholder="NPI à 13 chiffres de l'ANIP"
                      className="w-full pl-9 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl font-mono text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#059669] focus:bg-white transition-all"
                    />
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Health Info (Groupe Sanguin, Maladies, Antécédents, Allergies) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                <HeartPulse className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-black uppercase text-gray-700 tracking-wider font-sans">Profil Médical & Urgences</h4>
              </div>

              {/* Blood Group Select */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Groupe Sanguin</label>
                <div className="relative">
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl font-sans text-xs font-bold text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#059669] focus:bg-white transition-all appearance-none cursor-pointer"
                  >
                    <option value="">-- Non spécifié --</option>
                    <option value="A+">A Positif (A+)</option>
                    <option value="A-">A Négatif (A-)</option>
                    <option value="B+">B Positif (B+)</option>
                    <option value="B-">B Négatif (B-)</option>
                    <option value="AB+">AB Positif (AB+)</option>
                    <option value="AB-">AB Négatif (AB-)</option>
                    <option value="O+">O Positif (O+)</option>
                    <option value="O-">O Négatif (O-)</option>
                  </select>
                  <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs font-bold">▼</div>
                </div>
              </div>

              {/* Recurring Diseases */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Maladies Récurrentes (Pathologies courantes ou chroniques)</label>
                <div className="relative">
                  <textarea
                    value={recurringDiseases}
                    onChange={(e) => setRecurringDiseases(e.target.value)}
                    placeholder="Ex: Paludisme saisonnier récurrent, crises d'asthme légères en cas d'harmattan..."
                    rows={2}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl font-sans text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#059669] focus:bg-white transition-all resize-none"
                  />
                  <Activity className="absolute left-3 top-4 w-4 h-4 text-gray-400" />
                </div>
              </div>

              {/* Medical History / Antecedents */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Antécédents Médicaux, Chirurgicaux & Familiaux</label>
                <div className="relative">
                  <textarea
                    value={antecedents}
                    onChange={(e) => setAntecedents(e.target.value)}
                    placeholder="Ex: Chirurgie appendicectomie en 2021, antécédents d'hypertension artérielle familiale..."
                    rows={2}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl font-sans text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#059669] focus:bg-white transition-all resize-none"
                  />
                  <ClipboardList className="absolute left-3 top-4 w-4 h-4 text-gray-400" />
                </div>
              </div>

              {/* Allergies & Plus */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">Allergies, Intolérances et Notes supplémentaires ("Et plus")</label>
                <div className="relative">
                  <textarea
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="Ex: Allergie sévère à la Pénicilline, intolérance au lactose, asthme déclenché par la poussière..."
                    rows={2}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl font-sans text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#059669] focus:bg-white transition-all resize-none"
                  />
                  <AlertCircle className="absolute left-3 top-4 w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-emerald-100 pb-2">
                <Users className="h-4 w-4 text-emerald-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800">Contacts d’urgence</h4>
              </div>
              {patient.emergencyContacts?.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {patient.emergencyContacts.map((contact, index) => (
                    <div key={`${contact.phone}-${index}`} className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
                      <p className="text-sm font-black text-emerald-950">{contact.name}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-700"><Phone className="h-3.5 w-3.5" />{contact.phone}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-emerald-200 p-4 text-sm text-emerald-700">Aucun contact d’urgence renseigné.</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-emerald-100 pb-2">
                <Settings className="h-4 w-4 text-emerald-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800">Paramètres</h4>
              </div>
              <div className="divide-y divide-emerald-50 rounded-2xl border border-emerald-100 bg-white">
                <button type="button" onClick={() => setDarkMode(value => !value)} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left hover:bg-emerald-50/60"><Moon className="h-4 w-4 text-emerald-700" /><span className="flex-1 text-sm font-bold text-emerald-950">Mode sombre</span><span className="text-xs font-bold text-emerald-700">{darkMode ? 'Actif' : 'Inactif'}</span></button>
                <button type="button" onClick={() => setNotificationsEnabled(value => !value)} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left hover:bg-emerald-50/60"><Bell className="h-4 w-4 text-emerald-700" /><span className="flex-1 text-sm font-bold text-emerald-950">Notifications</span><span className="text-xs font-bold text-emerald-700">{notificationsEnabled ? 'Activées' : 'Désactivées'}</span></button>
                <div className="flex min-h-[52px] items-center gap-3 px-4"><Languages className="h-4 w-4 text-emerald-700" /><span className="flex-1 text-sm font-bold text-emerald-950">Langue</span><span className="text-xs font-bold text-emerald-700">Français</span></div>
                <button type="button" onClick={() => setError('La modification du mot de passe sera disponible dans la prochaine version.')} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left hover:bg-emerald-50/60"><LockKeyhole className="h-4 w-4 text-emerald-700" /><span className="flex-1 text-sm font-bold text-emerald-950">Sécurité</span><span className="text-xs font-bold text-emerald-700">Modifier</span></button>
                <div className="flex min-h-[52px] items-center gap-3 px-4"><Fingerprint className="h-4 w-4 text-emerald-700" /><span className="flex-1 text-sm font-bold text-emerald-950">Biométrie</span><span className="text-xs font-bold text-emerald-700">Activée</span></div>
              </div>
            </div>

          </form>

          {/* Footer Actions */}
          <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-bold font-sans text-xs transition-all cursor-pointer text-center"
            >
              Fermer
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="flex-1 py-3 bg-[#059669] hover:bg-[#059669]/90 disabled:bg-[#059669]/60 text-white rounded-xl font-bold font-sans text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Mettre à jour mon profil</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
