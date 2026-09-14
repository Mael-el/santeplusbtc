import React, { useEffect, useState } from 'react';
import { Activity, Database, RefreshCw, Users, UserRound, Stethoscope, Building2 } from 'lucide-react';
import { HospitalUser } from '../types';

interface PlatformOwnerDashboardProps {
  user: HospitalUser;
  onLogout: () => void;
}

interface Metrics {
  active: { total: number; patients: number; professionals: number };
  users: number;
  patients: number;
  doctors: number;
  hospitals: number;
  tables: Array<{ table: string; rows: number }>;
}

export default function PlatformOwnerDashboard({ user, onLogout }: PlatformOwnerDashboardProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState('');

  const loadMetrics = async () => {
    try {
      setError('');
      const response = await fetch('/api/platform/metrics', { credentials: 'include' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Accès refusé');
      setMetrics(payload.data);
    } catch (loadError: any) {
      setError(loadError.message || 'Impossible de charger les métriques.');
    }
  };

  useEffect(() => { void loadMetrics(); }, []);

  const cards = metrics ? [
    { label: 'Connectés maintenant', value: metrics.active.total, icon: Activity, tone: 'emerald' },
    { label: 'Patients connectés', value: metrics.active.patients, icon: UserRound, tone: 'blue' },
    { label: 'Professionnels connectés', value: metrics.active.professionals, icon: Stethoscope, tone: 'amber' },
    { label: 'Utilisateurs inscrits', value: metrics.users, icon: Users, tone: 'violet' },
    { label: 'Patients enregistrés', value: metrics.patients, icon: UserRound, tone: 'cyan' },
    { label: 'Médecins enregistrés', value: metrics.doctors, icon: Stethoscope, tone: 'rose' },
    { label: 'Hôpitaux enregistrés', value: metrics.hospitals, icon: Building2, tone: 'orange' },
  ] : [];

  return (
    <main className="role-dashboard min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">Propriétaire de la plateforme</p>
            <h1 className="mt-2 text-3xl font-black">Centre de supervision Santé+</h1>
            <p className="mt-1 text-sm text-slate-400">{user.email} · Vue nationale, séparée des hôpitaux</p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadMetrics} className="flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-bold hover:bg-white/10"><RefreshCw className="h-4 w-4" /> Actualiser</button>
            <button onClick={onLogout} className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold hover:bg-rose-600">Déconnexion</button>
          </div>
        </header>

        {error && <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-rose-200">{error}</div>}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(card => { const Icon = card.icon; return <div key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5"><Icon className="h-5 w-5 text-emerald-300" /><p className="mt-5 text-sm text-slate-400">{card.label}</p><p className="mt-1 text-3xl font-black">{card.value.toLocaleString('fr-FR')}</p></div>; })}
        </section>
        {metrics && <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06]"><div className="flex items-center gap-3 border-b border-white/10 px-5 py-4"><Database className="h-5 w-5 text-emerald-300" /><div><h2 className="font-black">Base PostgreSQL</h2><p className="text-xs text-slate-400">Nombre d’enregistrements par table</p></div></div><div className="grid grid-cols-1 divide-y divide-white/10 sm:grid-cols-2 sm:divide-y-0 sm:divide-x">{metrics.tables.map(table => <div key={table.table} className="flex justify-between px-5 py-3 text-sm"><span className="text-slate-300">{table.table}</span><strong>{table.rows.toLocaleString('fr-FR')}</strong></div>)}</div></section>}
      </div>
    </main>
  );
}
