import React from 'react';
import { LayoutDashboard, LogOut, Stethoscope } from 'lucide-react';

interface DoctorHeaderProps {
  doctorData: {
    id: string;
    name: string;
    email: string;
    specialty: string;
    hospitalName: string;
    avatar?: string;
  };
  onLogout?: () => void;
  onDashboard?: () => void;
}

export default function DoctorHeader({ doctorData, onLogout, onDashboard }: DoctorHeaderProps) {
  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('sante_role');
    localStorage.removeItem('sante_hospital_user');
    localStorage.removeItem('sante_hospital_token');
    localStorage.removeItem('sante_access_token');
    if (onLogout) {
      onLogout();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="page-enter relative w-full overflow-hidden bg-white/95 border border-slate-200 rounded-2xl px-3 sm:px-4 py-2.5 flex items-center justify-between mb-3 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
          <Stethoscope className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-extrabold text-slate-900 truncate">{doctorData.name}</p>
          <p className="text-xs text-slate-500 truncate">{doctorData.specialty} · {doctorData.hospitalName}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onDashboard}
          className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
          title="Revenir au tableau de bord"
        >
          <LayoutDashboard className="w-4 h-4" />
          <span className="hidden sm:inline">Tableau de bord</span>
        </button>
        <button
          onClick={handleLogout}
          className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-red-50 hover:text-red-600 flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
