import React, { useState } from 'react';

const phonePattern = /^(?:\+229\s?01\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}|01\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2})$/;

export default function HospitalRequestPage() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    functionName: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.fullName.trim()) {
      setError('Le nom complet est requis.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Veuillez saisir un email valide.');
      return;
    }
    if (!phonePattern.test(form.phone.trim())) {
      setError('Le numéro doit être au format Bénin : 01 97 00 00 00.');
      return;
    }
    if (!form.functionName.trim()) {
      setError('La fonction est obligatoire.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await fetch('/api/contact/professional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'hospital',
          name: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          functionName: form.functionName.trim(),
        }),
      }).catch(() => undefined);
      setSuccess(true);
      setForm({ fullName: '', email: '', phone: '', functionName: '' });
    } catch {
      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#ECFDF5] via-white to-[#E3F6EC] px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-4xl shadow-lg shadow-emerald-200">🧬</div>
          <h1 className="text-4xl font-black text-emerald-900">Santé+</h1>
          <p className="mt-2 text-sm text-emerald-700">Demande d’accompagnement hôpital</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-[28px] border border-emerald-200 bg-white p-6 shadow-[0_20px_50px_rgba(0,168,107,0.08)] sm:p-8">
          <h2 className="mb-6 text-2xl font-black text-emerald-900">Hôpital</h2>

          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {success && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-800">
              L'équipe SANTÉ+ BTC vous contactera prochainement
            </div>
          )}

          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-700">
              Nom complet
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 outline-none transition focus:border-emerald-500"
                placeholder="Nom complet"
              />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 outline-none transition focus:border-emerald-500"
                placeholder="contact@hopital.bj"
              />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Numéro de téléphone (Bénin, 10 chiffres)
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 outline-none transition focus:border-emerald-500"
                placeholder="01 97 00 00 00"
              />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Fonction
              <input
                type="text"
                value={form.functionName}
                onChange={(e) => handleChange('functionName', e.target.value)}
                className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 outline-none transition focus:border-emerald-500"
                placeholder="Directeur / Responsable administratif"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-3 text-lg font-black text-white shadow-lg shadow-emerald-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Envoi...' : 'Envoyer la demande'}
          </button>

          <div className="mt-5 text-center">
            <a href="/" className="text-sm font-bold text-emerald-700 hover:underline">Retour à l’accueil</a>
          </div>
        </form>

        <div className="mt-8 rounded-[28px] border border-emerald-200 bg-white p-6 shadow-[0_20px_50px_rgba(0,168,107,0.08)]">
          <h3 className="text-xl font-black text-emerald-900">Compte de démonstration</h3>
          <p className="mt-2 text-sm text-slate-600">Pour tester l’espace hôpital avant la mise en production.</p>

          <div className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Espace hôpital</p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p><span className="font-bold">Email :</span> hopital@demo.santeplus.bj</p>
              <p><span className="font-bold">Mot de passe :</span> Demo123!</p>
            </div>
            <ul className="mt-3 list-disc pl-5 text-sm text-slate-600">
              <li>Gérer les demandes de consultation</li>
              <li>Suivre les admissions et dossiers</li>
              <li>Organiser les services de soins</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
