import React, { useState } from 'react';

const phonePattern = /^(?:\+229\s?01\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}|01\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2})$/;
const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function PatientRegistrationPage() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    dateOfBirth: '',
    gender: 'Femme',
    bloodType: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('Le prénom et le nom sont obligatoires.');
      return;
    }

    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Veuillez saisir une adresse email valide.');
      return;
    }

    if (!phonePattern.test(form.phone.trim())) {
      setError('Le numéro doit être au format Bénin : 01 97 00 00 00 ou +229 01 97 00 00 00.');
      return;
    }

    if (!form.password || form.password.length < 8 || form.password.length > 128 || /\s/.test(form.password)) {
      setError('Le mot de passe doit contenir entre 8 et 128 caractères, sans espace.');
      return;
    }

    if (!form.dateOfBirth) {
      setError('La date de naissance est obligatoire.');
      return;
    }

    const birthDate = new Date(`${form.dateOfBirth}T00:00:00`);
    if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
      setError('La date de naissance est invalide ou dans le futur.');
      return;
    }

    if (!form.bloodType) {
      setError('Le groupe sanguin est obligatoire pour le dossier patient.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/register/patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          dateOfBirth: form.dateOfBirth,
          gender: form.gender,
          bloodType: form.bloodType,
          allergies: 'Aucune',
          emergencyContacts: [],
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Erreur lors de la création du compte.');
      }

      const user = payload.data?.user || {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: 'patient',
        bloodGroup: form.bloodType,
      };

      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('sante_role', 'patient');
      localStorage.setItem('sante_patient_profile', JSON.stringify({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        bloodGroup: form.bloodType,
        allergies: 'Aucune',
        emergencyContacts: [],
      }));
      window.location.href = '/patient/dashboard';
    } catch (err: any) {
      setError(err.message || 'Erreur serveur. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#ECFDF5] via-white to-[#E3F6EC] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-4xl shadow-lg shadow-emerald-200">🧬</div>
          <h1 className="text-4xl font-black text-emerald-900">Santé+</h1>
          <p className="mt-2 text-sm text-emerald-700">Créer mon espace patient sécurisé</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[28px] border border-emerald-200 bg-white p-6 shadow-[0_20px_50px_rgba(0,168,107,0.08)] sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-black text-emerald-900">Inscription patient</h2>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">
              Prénom
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => handleChange('firstName', e.target.value)}
                className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 outline-none ring-0 transition focus:border-emerald-500"
                placeholder="Votre prénom"
              />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Nom
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => handleChange('lastName', e.target.value)}
                className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 outline-none ring-0 transition focus:border-emerald-500"
                placeholder="Votre nom"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">
              Adresse email
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 outline-none transition focus:border-emerald-500"
                placeholder="prenom@email.com"
              />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Numéro de téléphone (Bénin, 10 chiffres)
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 outline-none transition focus:border-emerald-500"
                placeholder="Ex : 01 97 00 00 00"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">
              Mot de passe
              <input
                type="password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 outline-none transition focus:border-emerald-500"
                placeholder="••••••••"
              />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Date de naissance
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 outline-none transition focus:border-emerald-500"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">
              Sexe
              <select
                value={form.gender}
                onChange={(e) => handleChange('gender', e.target.value)}
                className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 outline-none transition focus:border-emerald-500"
              >
                <option value="Femme">Femme</option>
                <option value="Homme">Homme</option>
                <option value="Autre">Autre</option>
              </select>
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Groupe sanguin
              <select
                value={form.bloodType}
                onChange={(e) => handleChange('bloodType', e.target.value)}
                className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 outline-none transition focus:border-emerald-500"
              >
                <option value="">Sélectionner</option>
                {bloodGroups.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-3 text-lg font-black text-white shadow-lg shadow-emerald-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Création du compte...' : 'Créer mon compte'}
          </button>

          <p className="mt-5 text-center text-sm text-slate-600">
            Vous avez déjà un compte ?{' '}
            <a href="/connexion" className="font-bold text-emerald-700 hover:underline">Se connecter</a>
          </p>
        </form>
      </div>
    </div>
  );
}
