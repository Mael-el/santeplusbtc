import React, { useState } from 'react';
import { HospitalUser, Hospital, SpecialtyDepartment, MedicalEquipment, AdminPatientRecord } from '../types';
import { HOSPITALS } from '../data';
import SanteLogo from './SanteLogo';
import { 
  BarChart3, Users, Building2, Package, ShieldCheck, 
  Bell, Settings, Plus, Search, Download, AlertTriangle, 
  TrendingUp, TrendingDown, CheckCircle2, Clock, 
  Heart, Phone, FileText, ChevronDown, Check, X, 
  Stethoscope, Activity, Radio, Cpu, Droplet, ArrowRight,
  LogOut, Sparkles, Filter, CreditCard, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DirectorAdminDashboardProps {
  user: HospitalUser;
  onLogout: () => void;
  hospitals?: Hospital[];
}

export default function DirectorAdminDashboard({
  user,
  onLogout,
  hospitals = HOSPITALS
}: DirectorAdminDashboardProps) {
  // Current active tab among the 5 sections
  const [activeTab, setActiveTab] = useState<'dashboard' | 'doctors' | 'patients' | 'inventory' | 'audit'>('dashboard');

  // Hospital Name
  const currentHospital = hospitals.find(h => h.id === user.hospitalId) || {
    id: 'hospital-inconnu',
    name: 'Hôpital non renseigné',
    type: 'clinic',
    address: 'Bénin'
  };

  // --------------------------------------------------------------------------
  // STATE 1: GESTION DES SPÉCIALITÉS (IMAGE 3)
  // --------------------------------------------------------------------------
  const [specialties, setSpecialties] = useState<SpecialtyDepartment[]>([]);

  const [showAddSpecialtyModal, setShowAddSpecialtyModal] = useState(false);
  const [newSpecialtyName, setNewSpecialtyName] = useState('');
  const [newSpecialtyDesc, setNewSpecialtyDesc] = useState('');
  const [newSpecialtyDoctors, setNewSpecialtyDoctors] = useState('1');

  const handleAddSpecialty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpecialtyName.trim()) return;
    const newSpec: SpecialtyDepartment = {
      id: `spec-${Date.now()}`,
      name: newSpecialtyName.trim(),
      description: newSpecialtyDesc.trim() || 'Département clinique actif.',
      doctorsCount: parseInt(newSpecialtyDoctors) || 1,
      patientsCount: 0,
      icon: 'briefcase',
      status: 'active'
    };
    setSpecialties(prev => [...prev, newSpec]);
    setNewSpecialtyName('');
    setNewSpecialtyDesc('');
    setShowAddSpecialtyModal(false);
  };

  // --------------------------------------------------------------------------
  // STATE 2: GESTION DES ÉQUIPEMENTS & INVENTAIRE (IMAGE 4)
  // --------------------------------------------------------------------------
  const [equipments, setEquipments] = useState<MedicalEquipment[]>([
    {
      id: 'eq-1',
      name: 'Scanner IRM',
      unitsCount: 2,
      status: 'available',
      scheduledMaintenance: '01/06',
      icon: 'scan'
    },
    {
      id: 'eq-2',
      name: 'Échographe',
      unitsCount: 3,
      status: 'available',
      scheduledMaintenance: '15/05',
      icon: 'wave'
    },
    {
      id: 'eq-3',
      name: 'Radiographe',
      unitsCount: 1,
      status: 'maintenance',
      returnDate: '30/06',
      icon: 'radio'
    },
    {
      id: 'eq-4',
      name: 'Électrocardiographe',
      unitsCount: 2,
      status: 'available',
      icon: 'ecg'
    },
    {
      id: 'eq-5',
      name: 'Analyseur de sang',
      unitsCount: 1,
      status: 'available',
      icon: 'drop'
    }
  ]);

  const [showAddEquipmentModal, setShowAddEquipmentModal] = useState(false);
  const [newEquipmentName, setNewEquipmentName] = useState('');
  const [newEquipmentUnits, setNewEquipmentUnits] = useState('1');
  const [newEquipmentStatus, setNewEquipmentStatus] = useState<'available' | 'maintenance'>('available');

  const handleAddEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEquipmentName.trim()) return;
    const newEq: MedicalEquipment = {
      id: `eq-${Date.now()}`,
      name: newEquipmentName.trim(),
      unitsCount: parseInt(newEquipmentUnits) || 1,
      status: newEquipmentStatus,
      scheduledMaintenance: '01/08',
      icon: 'scan'
    };
    setEquipments(prev => [...prev, newEq]);
    setNewEquipmentName('');
    setShowAddEquipmentModal(false);
  };

  // --------------------------------------------------------------------------
  // STATE 3: GESTION DES PATIENTS (IMAGE 5)
  // --------------------------------------------------------------------------
  const [patientSearch, setPatientSearch] = useState('');
  const [patientFilter, setPatientFilter] = useState<'Tous' | 'Actifs' | 'Nouveaux' | 'Urgents'>('Tous');
  const [patients, setPatients] = useState<AdminPatientRecord[]>([]);

  const [selectedPatientAction, setSelectedPatientAction] = useState<{ patient: AdminPatientRecord; type: 'dossier' | 'suivi' | 'facture' } | null>(null);

  // Blood Alert state (Image 2)
  const [bloodAlertSent, setBloodAlertSent] = useState(false);

  const handleSendBloodAlert = () => {
    setBloodAlertSent(true);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance("Alerte de stock sanguin non activée. Aucune donnée de démonstration n’est affichée.");
      u.lang = 'fr-FR';
      window.speechSynthesis.speak(u);
    }
    setTimeout(() => setBloodAlertSent(false), 5000);
  };

  // Filtered patients
  const filteredPatients = patients.filter(p => {
    const matchesQuery = p.name.toLowerCase().includes(patientSearch.toLowerCase()) || (p.npi && p.npi.toLowerCase().includes(patientSearch.toLowerCase()));
    if (!matchesQuery) return false;
    if (patientFilter === 'Actifs') return p.status === 'active';
    if (patientFilter === 'Nouveaux') return p.status === 'new';
    if (patientFilter === 'Urgents') return p.status === 'urgent' || p.hasAlert;
    return true;
  });

  return (
    <div className="role-dashboard w-full max-w-6xl mx-auto flex flex-col font-sans pb-16">
      
      {/* ---------------------------------------------------- */}
      {/* TOP HEADER ADMIN / DIRECTEUR (COMPACT & MÉDICAL)     */}
      {/* ---------------------------------------------------- */}
      <div className="w-full bg-white/90 backdrop-blur-xs rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">{currentHospital.name}</h2>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Centre Référent
                </span>
              </div>
              <p className="text-xs text-slate-500 font-sans">Direction Hospitalière & Régulation Médicale • République du Bénin</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Synchronisation active : 100%</span>
            </span>
          </div>
        </div>

        {/* ONGLETS DESKTOP EN LIGNE (ÉLIMINE LE DÉFILEMENT INUTILE) */}
        <div className="hidden sm:flex items-center gap-1.5 pt-3 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Vue d\'ensemble', icon: BarChart3 },
            { id: 'doctors', label: 'Praticiens & Services', icon: Building2 },
            { id: 'patients', label: 'Registre Patients', icon: Users },
            { id: 'inventory', label: 'Pharmacie & Équipements', icon: Package },
            { id: 'audit', label: 'Audit & Conformité', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* CONTENU SELON L'ONGLET ACTIF                         */}
      {/* ---------------------------------------------------- */}

      {/* ==================================================== */}
      {/* TAB 1: VUE D'ENSEMBLE (IMAGE 2)                      */}
      {/* ==================================================== */}
      {activeTab === 'dashboard' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          {/* Badge Établissement (Image 2) */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#E0F8EC] border border-emerald-200 text-[#006633] rounded-2xl text-sm sm:text-base font-black shadow-3xs">
            <span className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">+</span>
            <span>{currentHospital.name}</span>
          </div>

          {/* Titre & Sous-titre */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 font-sans tracking-tight">
              Vue d'ensemble
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 font-sans mt-0.5">
              Mois en cours (Novembre 2023)
            </p>
          </div>

          {/* 4 Cartes Métriques (Image 2) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            
            {/* 1. Patients total */}
            <div className="bg-[#EAFBF3] border border-emerald-100 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-200/70 text-emerald-800 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 bg-emerald-200/80 text-emerald-900 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> +15%
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-600 block font-medium">Patients total</span>
                <span className="text-2xl sm:text-3xl font-black text-gray-900 font-sans tracking-tight">1 240</span>
              </div>
            </div>

            {/* 2. Consults (ce mois) */}
            <div className="bg-[#EAFBF3] border border-emerald-100 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-amber-200/70 text-amber-900 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 bg-emerald-200/80 text-emerald-900 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> +20%
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-600 block font-medium">Consults (ce mois)</span>
                <span className="text-2xl sm:text-3xl font-black text-gray-900 font-sans tracking-tight">356</span>
              </div>
            </div>

            {/* 3. Revenus (FCFA) */}
            <div className="bg-[#EAFBF3] border border-emerald-100 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-orange-200/70 text-orange-900 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-0.5">
                  <TrendingDown className="w-3 h-3" /> -25%
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-600 block font-medium">Revenus (FCFA)</span>
                <span className="text-2xl sm:text-3xl font-black text-gray-900 font-sans tracking-tight">2.4M</span>
              </div>
            </div>

            {/* 4. Dons (ce mois) */}
            <div className="bg-[#EAFBF3] border border-emerald-100 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                  <Droplet className="w-5 h-5" />
                </div>
                <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-[10px] sm:text-xs font-bold">
                  Urgent
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-600 block font-medium">Dons (ce mois)</span>
                <span className="text-2xl sm:text-3xl font-black text-gray-900 font-sans tracking-tight">12</span>
              </div>
            </div>

          </div>

          {/* Graphique Évolution Mensuelle — SVG Interactif */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg sm:text-xl font-black text-gray-900 font-sans">
                Évolution sur 6 mois
              </h3>
              <div className="px-3 py-1.5 bg-emerald-100/70 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+18% global</span>
              </div>
            </div>

            {/* SVG Bar Chart dynamique */}
            {(() => {
              const months = ['Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov'];
              const patients = [820, 940, 1020, 1080, 1160, 1240];
              const consults = [210, 265, 288, 310, 335, 356];
              const maxVal = Math.max(...patients);
              const chartH = 160;
              const barW = 28;
              const gap = 18;
              const totalW = months.length * (barW * 2 + gap + 10);
              return (
                <div className="overflow-x-auto">
                  <svg viewBox={`0 0 ${totalW} ${chartH + 30}`} className="w-full min-w-[320px]" style={{height: 200}}>
                    {/* Y axis grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                      <line key={f} x1="0" y1={chartH - f * chartH} x2={totalW} y2={chartH - f * chartH}
                        stroke="#f0f0f0" strokeWidth="1" />
                    ))}
                    {months.map((m, i) => {
                      const x = i * (barW * 2 + gap + 10) + 5;
                      const ph = (patients[i] / maxVal) * chartH;
                      const ch = (consults[i] / maxVal) * chartH;
                      return (
                        <g key={m}>
                          {/* Patients bar */}
                          <rect x={x} y={chartH - ph} width={barW} height={ph}
                            rx="5" fill={i === months.length - 1 ? '#006633' : '#34a46e'}
                            opacity={i === months.length - 1 ? 1 : 0.7}
                            className="transition-all" />
                          {/* Consultations bar */}
                          <rect x={x + barW + 4} y={chartH - ch} width={barW} height={ch}
                            rx="5" fill={i === months.length - 1 ? '#f59e0b' : '#fbbf24'}
                            opacity={i === months.length - 1 ? 1 : 0.7}
                            className="transition-all" />
                          {/* Month label */}
                          <text x={x + barW} y={chartH + 18} textAnchor="middle"
                            fontSize="10" fontWeight="bold"
                            fill={i === months.length - 1 ? '#006633' : '#9ca3af'}>
                            {m}
                          </text>
                          {/* Value label on top bar (last month only) */}
                          {i === months.length - 1 && (
                            <>
                              <text x={x + barW / 2} y={chartH - ph - 4} textAnchor="middle"
                                fontSize="9" fontWeight="bold" fill="#006633">{patients[i]}</text>
                              <text x={x + barW * 1.5 + 4} y={chartH - ch - 4} textAnchor="middle"
                                fontSize="9" fontWeight="bold" fill="#d97706">{consults[i]}</text>
                            </>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              );
            })()}

            {/* Légende */}
            <div className="flex items-center justify-center gap-6 text-xs text-gray-600 font-bold">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#006633]"></span>
                <span>Patients</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                <span>Consultations</span>
              </div>
            </div>
          </div>

          {/* Graphique Donut — Répartition par Spécialité */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <h3 className="text-lg sm:text-xl font-black text-gray-900 font-sans">
              Répartition par Spécialité
            </h3>
            {(() => {
              const data = [
                { label: 'Médecine Générale', value: 45, color: '#006633' },
                { label: 'Pédiatrie', value: 30, color: '#34a46e' },
                { label: 'Cardiologie', value: 25, color: '#f59e0b' },
                { label: 'Gynécologie', value: 20, color: '#ef4444' },
                { label: 'Orthopédie', value: 12, color: '#8b5cf6' },
              ];
              const total = data.reduce((s, d) => s + d.value, 0);
              const cx = 80, cy = 80, r = 60, innerR = 35;
              let startAngle = -Math.PI / 2;
              const arcs = data.map(d => {
                const angle = (d.value / total) * 2 * Math.PI;
                const x1 = cx + r * Math.cos(startAngle);
                const y1 = cy + r * Math.sin(startAngle);
                const x2 = cx + r * Math.cos(startAngle + angle);
                const y2 = cy + r * Math.sin(startAngle + angle);
                const xi1 = cx + innerR * Math.cos(startAngle);
                const yi1 = cy + innerR * Math.sin(startAngle);
                const xi2 = cx + innerR * Math.cos(startAngle + angle);
                const yi2 = cy + innerR * Math.sin(startAngle + angle);
                const large = angle > Math.PI ? 1 : 0;
                const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${innerR} ${innerR} 0 ${large} 0 ${xi1} ${yi1} Z`;
                startAngle += angle;
                return { ...d, path };
              });
              return (
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <svg viewBox="0 0 160 160" className="w-40 h-40 shrink-0">
                    {arcs.map((arc, i) => (
                      <path key={i} d={arc.path} fill={arc.color} opacity={0.9} className="hover:opacity-100 transition-opacity" />
                    ))}
                    <text x={cx} y={cy - 4} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#111827">{total}</text>
                    <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#6b7280">patients</text>
                  </svg>
                  <div className="flex-1 space-y-2 w-full">
                    {arcs.map((arc, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: arc.color}}></span>
                          <span className="text-xs font-medium text-gray-700 truncate">{arc.label}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{width: `${(arc.value/total)*100}%`, backgroundColor: arc.color}}></div>
                          </div>
                          <span className="text-xs font-black text-gray-800 w-6 text-right">{arc.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Alerte Urgence Sang (Image 2) */}
          <div className="bg-[#FFF8F5] border border-orange-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-red-700 font-black text-sm sm:text-base">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>Alerte Urgence Sang</span>
            </div>

            <div>
              <h4 className="text-lg sm:text-xl font-black text-red-600 font-sans">
                Aucune alerte de stock active
              </h4>
              <p className="text-xs sm:text-sm text-gray-600 font-sans mt-0.5 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-gray-500" />
                <span>12 donneurs compatibles disponibles</span>
              </p>
            </div>

            {bloodAlertSent ? (
              <div className="p-3 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                <span>Aucune notification d’urgence n’est actuellement déclenchée.</span>
              </div>
            ) : (
              <button
                onClick={handleSendBloodAlert}
                className="w-full py-3.5 bg-[#E63935] hover:bg-[#C92A26] text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Bell className="w-4 h-4" />
                <span>Envoyer une alerte</span>
              </button>
            )}
          </div>
        </motion.div>
      )}


      {/* ==================================================== */}
      {/* TAB 2: GESTION DES SPÉCIALITÉS (IMAGE 3)             */}
      {/* ==================================================== */}
      {activeTab === 'doctors' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 font-sans tracking-tight">
              Gestion des Spécialités
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 font-sans mt-0.5">
              Gérez les départements cliniques et leurs ressources.
            </p>
          </div>

          {/* Bouton Ajouter une spécialité (Image 3) */}
          <button
            onClick={() => setShowAddSpecialtyModal(true)}
            className="w-full py-3.5 bg-[#00D26A] hover:bg-[#00B85C] text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <Plus className="w-5 h-5" />
            <span>Ajouter une spécialité</span>
          </button>

          {/* Carte Vue d'ensemble (Image 3) */}
          <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs space-y-2.5">
            <h3 className="text-sm font-black text-gray-800 font-sans">
              Vue d'ensemble
            </h3>
            
            <div className="space-y-2 text-xs sm:text-sm text-gray-600 font-medium">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span>Spécialités</span>
                <span className="font-black text-gray-900">{specialties.length}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span>Médecins Total</span>
                <span className="font-black text-gray-900">{specialties.reduce((acc, s) => acc + s.doctorsCount, 0)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Patients Actifs</span>
                <span className="font-black text-gray-900">{specialties.reduce((acc, s) => acc + s.patientsCount, 0)}</span>
              </div>
            </div>
          </div>

          {/* Liste des Spécialités (Image 3) */}
          <div className="space-y-4">
            {specialties.map(spec => (
              <div key={spec.id} className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    {spec.name.includes('Cardio') ? <Heart className="w-5 h-5 text-red-500" /> : spec.name.includes('Pédiatrie') ? <Users className="w-5 h-5 text-blue-500" /> : <Stethoscope className="w-5 h-5 text-emerald-700" />}
                  </div>
                  <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    Actif
                  </span>
                </div>

                <div>
                  <h4 className="text-base sm:text-lg font-black text-gray-900 font-sans">
                    {spec.name}
                  </h4>
                  <p className="text-xs text-gray-500 font-sans mt-0.5">
                    {spec.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-[#EAFBF3] rounded-2xl border border-emerald-100">
                    <span className="text-[11px] text-gray-600 block">Médecins</span>
                    <span className="text-sm font-black text-gray-900 flex items-center gap-1 mt-0.5">
                      <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
                      {spec.doctorsCount}
                    </span>
                  </div>
                  <div className="p-3 bg-[#EAFBF3] rounded-2xl border border-emerald-100">
                    <span className="text-[11px] text-gray-600 block">Patients</span>
                    <span className="text-sm font-black text-gray-900 flex items-center gap-1 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      {spec.patientsCount}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ==================================================== */}
      {/* TAB 3: GESTION DES PATIENTS (IMAGE 5)                */}
      {/* ==================================================== */}
      {activeTab === 'patients' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 font-sans tracking-tight">
              Gestion des Patients
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 font-sans mt-0.5">
              Gérez les dossiers, le suivi et la facturation.
            </p>
          </div>

          {/* Moteur de Recherche (Image 5) */}
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Rechercher un patient..."
              className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans focus:outline-none focus:border-emerald-500 shadow-xs"
            />
          </div>

          {/* Bouton Exporter (Image 5) */}
          <button
            onClick={() => alert("Exportation du registre sécurisé des patients au format CSV/PDF certifié cryptographiquement.")}
            className="w-full py-3 bg-[#006633] hover:bg-[#004D26] text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Exporter</span>
          </button>

          {/* Filtres Pilules (Image 5) */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none text-xs font-bold font-sans">
            {(['Tous', 'Actifs', 'Nouveaux', 'Urgents'] as const).map(f => (
              <button
                key={f}
                onClick={() => setPatientFilter(f)}
                className={`px-4 py-2 rounded-2xl border transition-all cursor-pointer ${
                  patientFilter === f 
                    ? 'bg-[#EAFBF3] border-emerald-400 text-emerald-900 shadow-3xs font-black' 
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-slate-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Liste des Patients (Image 5) */}
          <div className="space-y-4">
            {filteredPatients.map(pat => (
              <div key={pat.id} className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-slate-100 border border-gray-200 text-gray-800 font-bold flex items-center justify-center text-sm">
                      {pat.initials}
                    </div>
                    <div>
                      <h4 className="text-base font-black text-gray-900 font-sans">{pat.name}</h4>
                      <p className="text-xs text-gray-500 font-sans">{pat.age} ans • {pat.consultsCount} consults</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1 ${
                      pat.hasAlert ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>
                      {pat.bloodGroup} {pat.hasAlert && <AlertTriangle className="w-3 h-3 text-red-500" />}
                    </span>
                    {pat.isDonor && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black uppercase">
                        Donneur
                      </span>
                    )}
                  </div>
                </div>

                {/* 3 Actions par patient (Image 5) */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => setSelectedPatientAction({ patient: pat, type: 'dossier' })}
                    className="py-2.5 bg-white hover:bg-slate-50 border border-gray-200 text-gray-800 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
                  >
                    Dossier
                  </button>
                  <button
                    onClick={() => setSelectedPatientAction({ patient: pat, type: 'suivi' })}
                    className="py-2.5 bg-white hover:bg-slate-50 border border-gray-200 text-gray-800 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
                  >
                    Suivi
                  </button>
                  <button
                    onClick={() => setSelectedPatientAction({ patient: pat, type: 'facture' })}
                    className="py-2.5 bg-amber-50 hover:bg-amber-100/60 border border-amber-200 text-amber-900 rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
                  >
                    Facture
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Aperçu Global (Image 5) */}
          <div className="bg-[#EAFBF3] border border-emerald-100 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <h3 className="text-xl font-black text-gray-900 font-sans">
              Aperçu Global
            </h3>

            <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Total Patients</span>
                <span className="text-2xl font-black text-gray-900 font-sans">1 240</span>
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
              <span className="text-xs font-bold text-gray-700 block">Groupes Sanguins (Top)</span>
              <div className="flex gap-2 text-xs font-bold">
                <span className="px-3 py-1.5 bg-[#EAFBF3] text-emerald-900 rounded-xl border border-emerald-200">
                  Non renseigné (0%)
                </span>
                <span className="px-3 py-1.5 bg-[#EAFBF3] text-emerald-900 rounded-xl border border-emerald-200">
                  Aucune donnée (0%)
                </span>
                <span className="px-3 py-1.5 bg-[#EAFBF3] text-emerald-900 rounded-xl border border-emerald-200">
                  B+ (15%)
                </span>
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Heart className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Donneurs (Ce mois)</span>
                <span className="text-2xl font-black text-gray-900 font-sans">12</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ==================================================== */}
      {/* TAB 4: GESTION DES ÉQUIPEMENTS (IMAGE 4)             */}
      {/* ==================================================== */}
      {activeTab === 'inventory' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 font-sans tracking-tight">
              Gestion des Équipements
            </h2>
          </div>

          {/* 2 Boutons Supérieurs (Image 4) */}
          <div className="space-y-2.5">
            <button
              onClick={() => setShowAddEquipmentModal(true)}
              className="w-full py-3.5 bg-[#00D26A] hover:bg-[#00B85C] text-white font-bold rounded-2xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-5 h-5" />
              <span>Ajouter un équipement</span>
            </button>

            <button
              onClick={() => alert("Statistiques globales d'utilisation des équipements : Taux de disponibilité 89%, 1 IRM en surchauffe régulée.")}
              className="w-full py-3 bg-[#EAFBF3] hover:bg-emerald-100/70 border border-emerald-200 text-[#006633] font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-3xs"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Voir les statistiques</span>
            </button>
          </div>

          {/* 3 Cartes Compteurs (Image 4) */}
          <div className="space-y-3">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">TOTAL ÉQUIPEMENTS</span>
                <span className="text-xl font-black text-gray-900">{equipments.length}</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">DISPONIBLES</span>
                <span className="text-xl font-black text-gray-900">{equipments.filter(e => e.status === 'available').length}</span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">EN MAINTENANCE</span>
                <span className="text-xl font-black text-red-600">{equipments.filter(e => e.status === 'maintenance').length}</span>
              </div>
            </div>
          </div>

          {/* Liste des Équipements (Image 4) */}
          <div className="space-y-4">
            {equipments.map(eq => (
              <div key={eq.id} className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    {eq.name.includes('Radio') ? <Radio className="w-5 h-5 text-emerald-700" /> : eq.name.includes('Écho') ? <Activity className="w-5 h-5 text-emerald-700" /> : <Cpu className="w-5 h-5 text-emerald-700" />}
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1 border ${
                    eq.status === 'available'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-600 border-red-200'
                  }`}>
                    {eq.status === 'available' ? 'Disponible' : 'En maintenance'}
                  </span>
                </div>

                <div>
                  <h4 className="text-base sm:text-lg font-black text-gray-900 font-sans">{eq.name}</h4>
                  <p className="text-xs text-gray-500 font-sans">{eq.unitsCount} unité(s) {eq.status === 'available' ? 'en service' : 'hors service'}</p>
                </div>

                <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                  eq.status === 'available'
                    ? 'bg-[#EAFBF3] text-emerald-900 border border-emerald-100'
                    : 'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  {eq.status === 'available' ? (
                    <>
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span>{eq.scheduledMaintenance ? `Maintenance prévue : ${eq.scheduledMaintenance}` : 'Maintenance à jour'}</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span>Retour prévu : {eq.returnDate || '30/06'}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ==================================================== */}
      {/* TAB 5: AUDIT & BLOCKCHAIN BITCOIN                    */}
      {/* ==================================================== */}
      {activeTab === 'audit' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 font-sans tracking-tight">
              Audit & conformité
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 font-sans mt-0.5">
              Registre immuable des actes médicaux et factures Lightning.
            </p>
          </div>

          <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-gray-900 font-sans">Nœud Lightning Hospitalier</h4>
                <p className="text-xs text-gray-500">Canal sécurisé Banque Centrale & MSP Bénin</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-gray-200 rounded-2xl font-mono text-xs text-gray-700 space-y-1">
              <div className="flex justify-between">
                <span>Nœud ID:</span>
                <span className="font-bold text-gray-900">02a1b...89fc</span>
              </div>
              <div className="flex justify-between">
                <span>Capacité Canal:</span>
                <span className="font-bold text-emerald-700">5 000 000 Sats (3.2M FCFA)</span>
              </div>
              <div className="flex justify-between">
                <span>Dernier Bloc Ancré:</span>
                <span className="font-bold text-gray-900">#891423</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* BARRE DE NAVIGATION INFÉRIEURE (MOBILE UNIQUEMENT) */}
      {/* ---------------------------------------------------- */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-2 flex items-center justify-around shadow-lg">
        
        {/* 1. Dashboard */}
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'dashboard' ? 'bg-[#006633] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] font-bold">Dash</span>
        </button>

        {/* 2. Doctors / Spécialités */}
        <button
          onClick={() => setActiveTab('doctors')}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'doctors' ? 'bg-[#006633] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Building2 className="w-5 h-5" />
          <span className="text-[10px] font-bold">Docs</span>
        </button>

        {/* 3. Patients */}
        <button
          onClick={() => setActiveTab('patients')}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'patients' ? 'bg-[#006633] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-bold">Patients</span>
        </button>

        {/* 4. Inventory / Équipements */}
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'inventory' ? 'bg-[#006633] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Package className="w-5 h-5" />
          <span className="text-[10px] font-bold">Inventory</span>
        </button>

        {/* 5. Audit */}
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === 'audit' ? 'bg-[#006633] text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span className="text-[10px] font-bold">Audit</span>
        </button>

      </nav>

      {/* MODAL : AJOUT SPÉCIALITÉ */}
      {showAddSpecialtyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-900 font-sans">Ajouter une Spécialité</h3>
              <button onClick={() => setShowAddSpecialtyModal(false)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAddSpecialty} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nom de la spécialité</label>
                <input
                  type="text"
                  value={newSpecialtyName}
                  onChange={(e) => setNewSpecialtyName(e.target.value)}
                  placeholder="Ex : Ophtalmologie"
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description du service</label>
                <input
                  type="text"
                  value={newSpecialtyDesc}
                  onChange={(e) => setNewSpecialtyDesc(e.target.value)}
                  placeholder="Ex : Soins et chirurgie de la vue."
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nombre de médecins affectés</label>
                <input
                  type="number"
                  min="1"
                  value={newSpecialtyDoctors}
                  onChange={(e) => setNewSpecialtyDoctors(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSpecialtyModal(false)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-2xl text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#00D26A] text-white font-bold rounded-2xl text-xs cursor-pointer shadow-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL : AJOUT ÉQUIPEMENT */}
      {showAddEquipmentModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-gray-900 font-sans">Ajouter un Équipement</h3>
              <button onClick={() => setShowAddEquipmentModal(false)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleAddEquipment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nom de l'équipement</label>
                <input
                  type="text"
                  value={newEquipmentName}
                  onChange={(e) => setNewEquipmentName(e.target.value)}
                  placeholder="Ex : Défibrillateur automatique"
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nombre d'unités</label>
                <input
                  type="number"
                  min="1"
                  value={newEquipmentUnits}
                  onChange={(e) => setNewEquipmentUnits(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs sm:text-sm font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Statut initial</label>
                <select
                  value={newEquipmentStatus}
                  onChange={(e) => setNewEquipmentStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-2xl text-xs font-sans"
                >
                  <option value="available">Disponible immédiatement</option>
                  <option value="maintenance">En maintenance préventive</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEquipmentModal(false)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-2xl text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#00D26A] text-white font-bold rounded-2xl text-xs cursor-pointer shadow-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL : ACTION PATIENT (DOSSIER / SUIVI / FACTURE) */}
      {selectedPatientAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                  {selectedPatientAction.patient.initials}
                </div>
                <h3 className="text-base font-black text-gray-900 font-sans">
                  {selectedPatientAction.patient.name}
                </h3>
              </div>
              <button onClick={() => setSelectedPatientAction(null)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 bg-slate-50 border border-gray-100 rounded-2xl space-y-2 text-xs text-gray-700">
              <div className="flex justify-between">
                <span>NPI National :</span>
                <span className="font-bold text-gray-900">{selectedPatientAction.patient.npi}</span>
              </div>
              <div className="flex justify-between">
                <span>Groupe Sanguin :</span>
                <span className="font-bold text-emerald-700">{selectedPatientAction.patient.bloodGroup}</span>
              </div>
              <div className="flex justify-between">
                <span>Téléphone :</span>
                <span className="font-bold text-gray-900">{selectedPatientAction.patient.phone}</span>
              </div>
              <div className="flex justify-between">
                <span>Consultations :</span>
                <span className="font-bold text-gray-900">{selectedPatientAction.patient.consultsCount} visites</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  alert(`Action ${selectedPatientAction.type.toUpperCase()} exécutée pour ${selectedPatientAction.patient.name}.`);
                  setSelectedPatientAction(null);
                }}
                className="w-full py-3 bg-[#006633] text-white font-bold rounded-2xl text-xs cursor-pointer shadow-sm"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
