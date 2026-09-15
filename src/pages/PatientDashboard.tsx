import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  Droplets,
  FileText,
  HeartPulse,
  QrCode,
  ShieldCheck,
  Stethoscope,
  UserCircle2,
  Wallet,
  ClipboardList,
  BellRing,
  Activity,
  CheckCircle2,
} from 'lucide-react';

const emergencyNumbers = [
  { label: 'SAMU', value: '15' },
  { label: 'Pompiers', value: '118' },
  { label: 'Urgence nationale', value: '112' },
];

const tabs = [
  { id: 'overview', label: 'Vue d’ensemble' },
  { id: 'records', label: 'Dossiers' },
  { id: 'qr', label: 'QR médical' },
  { id: 'blood', label: 'Don de sang' },
  { id: 'appointments', label: 'Rendez-vous' },
  { id: 'payments', label: 'Paiements' },
] as const;

type TabId = (typeof tabs)[number]['id'];

export const PatientDashboard = () => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const patient = useMemo(() => {
    const storedUser = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || 'null') : null;
    const storedProfile = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('sante_patient_profile') || 'null') : null;
    const fullName = [storedUser?.firstName, storedUser?.lastName, storedProfile?.firstName, storedProfile?.lastName]
      .filter(Boolean)
      .join(' ') || 'Patient';

    return {
      name: fullName,
      email: storedUser?.email || '',
      npi: storedUser?.npi || 'NPI non attribué',
      bloodGroup: storedUser?.bloodGroup || storedProfile?.bloodGroup || 'Non renseigné',
      allergies: storedProfile?.allergies || 'Aucune',
      chronicDiseases: 'Aucune',
      nextAppointment: 'Aucun rendez-vous',
      lastConsultation: 'Aucune consultation',
      wallet: 0,
    };
  }, []);

  const quickStats = useMemo(
    () => [
      { label: 'Dossier sécurisé', value: '0%', icon: ShieldCheck },
      { label: 'Ordonnances', value: '0', icon: FileText },
      { label: 'Dernière analyse', value: '—', icon: HeartPulse },
    ],
    []
  );

  const records: Array<{ title: string; date: string; doctor: string; status: string }> = [];

  const appointments: Array<{ title: string; date: string; place: string }> = [];

  const paymentHistory: Array<{ label: string; amount: string; status: string }> = [];

  const renderOverview = () => (
    <>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickStats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">{label}</p>
              <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </span>
            </div>
            <p className="text-2xl font-black text-slate-900 mt-3">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-900">Actions rapides</h2>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">Actif</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: 'QR médical', desc: 'Partager votre identité', icon: QrCode },
              { title: 'Dossier médical', desc: 'Historique et examens', icon: FileText },
              { title: 'Don de sang', desc: 'Aider la banque de sang', icon: Droplets },
              { title: 'Paiement', desc: 'Solde et factures', icon: CreditCard },
            ].map(({ title, desc, icon: Icon }) => (
              <button key={title} className="text-left border border-slate-200 rounded-2xl p-4 hover:border-emerald-300 hover:bg-emerald-50/40 transition">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{title}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end text-emerald-700 font-semibold text-xs">
                  Ouvrir <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-900 mb-4">Profil santé</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-slate-500">Groupe sanguin</span><span className="font-bold text-slate-900">{patient.bloodGroup}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Allergies</span><span className="font-bold text-slate-900">{patient.allergies}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Maladies chroniques</span><span className="font-bold text-slate-900">{patient.chronicDiseases}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Prochain RDV</span><span className="font-bold text-slate-900 text-right">{patient.nextAppointment}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Dernière consultation</span><span className="font-bold text-slate-900 text-right">{patient.lastConsultation}</span></div>
          </div>

          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-rose-700">Numéros d’urgence</p>
            <div className="mt-3 space-y-2">
              {emergencyNumbers.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-700">{label}</span>
                  <span className="font-black text-rose-700">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );

  const renderRecords = () => (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-black text-slate-900">Dossiers médicaux</h2>
        <button className="text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl">+ Nouveau document</button>
      </div>

      <div className="space-y-3">
        {records.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center text-slate-500 text-sm">
            Aucun document médical n’est disponible pour le moment.
          </div>
        ) : records.map((record) => (
          <div key={record.title} className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center"><ClipboardList className="w-4 h-4" /></div>
              <div>
                <p className="font-bold text-slate-900">{record.title}</p>
                <p className="text-xs text-slate-500">{record.date} • {record.doctor}</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">{record.status}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderQr = () => (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-900 mb-4">QR médical sécurisé</h2>
      <div className="max-w-md mx-auto bg-slate-50 border border-dashed border-slate-300 rounded-3xl p-6 text-center">
        <div className="h-44 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 font-black tracking-[0.25rem]">
          QR
        </div>
        <p className="mt-4 font-bold text-slate-900">NPI {patient.npi}</p>
        <p className="text-xs text-slate-500">Identifier le patient à l’accueil et chez les praticiens autorisés.</p>
      </div>
    </div>
  );

  const renderBlood = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900 mb-4">Éligibilité au don</h2>
        <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-bold">Vous êtes éligible pour donner</span>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          <li>• Dernier don : 30 Juin 2026</li>
          <li>• Prochain don possible : 30 Août 2026</li>
          <li>• Groupe sanguin : {patient.bloodGroup}</li>
        </ul>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900 mb-4">Besoins de la banque de sang</h2>
        <div className="space-y-3 text-sm text-slate-700">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-slate-700 font-bold">Aucune donnée urgente pour le moment</div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-amber-800 font-bold">Aucune demande de donneur active</div>
        </div>
      </div>
    </div>
  );

  const renderAppointments = () => (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-900 mb-4">Rendez-vous à venir</h2>
      <div className="space-y-3">
        {appointments.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center text-slate-500 text-sm">
            Aucun rendez-vous n’est programmé pour le moment.
          </div>
        ) : appointments.map((item) => (
          <div key={item.title} className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><CalendarDays className="w-4 h-4" /></div>
              <div>
                <p className="font-bold text-slate-900">{item.title}</p>
                <p className="text-xs text-slate-500">{item.place}</p>
              </div>
            </div>
            <span className="text-sm font-bold text-slate-800">{item.date}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPayments = () => (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-900 mb-4">Historique de paiements</h2>
      <div className="space-y-3">
        {paymentHistory.length === 0 ? (
          <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center text-slate-500 text-sm">
            Aucun paiement enregistré pour le moment.
          </div>
        ) : paymentHistory.map((item) => (
          <div key={item.label} className="flex items-center justify-between border border-slate-200 rounded-2xl p-3">
            <div>
              <p className="font-bold text-slate-900">{item.label}</p>
              <p className="text-xs text-slate-500">{item.amount}</p>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${item.status === 'Payé' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const panes: Record<TabId, React.ReactNode> = {
    overview: renderOverview(),
    records: renderRecords(),
    qr: renderQr(),
    blood: renderBlood(),
    appointments: renderAppointments(),
    payments: renderPayments(),
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <UserCircle2 className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Espace patient</p>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900">{patient.name}</h1>
                <p className="text-sm text-slate-500">NPI {patient.npi} • {patient.email}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Solde</p>
                <p className="text-lg font-extrabold text-slate-900">{patient.wallet.toLocaleString('fr-FR')} FCFA</p>
              </div>
              <button className="bg-emerald-600 text-white px-4 py-2.5 rounded-2xl font-bold text-sm shadow-sm hover:bg-emerald-700 transition">
                Recharger mon portefeuille
              </button>
            </div>
          </div>
        </header>

        <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <section className="space-y-4">{panes[activeTab]}</section>
      </div>
    </div>
  );
};
