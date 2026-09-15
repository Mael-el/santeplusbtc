import React, { useState, useEffect } from 'react';
import DoctorHeader from './doctor/DoctorHeader';
import ClinicalWorkspace from './doctor/ClinicalWorkspace';
import { getDoctorProfile } from '../services/doctorApi';
import { readDoctorWorkspace, subscribeDoctorWorkspace, writeDoctorWorkspace } from '../services/doctorWorkspace';
import { HospitalUser } from '../types';
import { Activity } from 'lucide-react';

interface DoctorData {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  npi: string;
  hospitalId: string;
  hospitalName: string;
  avatar?: string;
}

interface DoctorDashboardProps {
  user?: HospitalUser;
  onLogout?: () => void;
}

export default function DoctorDashboard({ user, onLogout }: DoctorDashboardProps = {}) {
  const getFallbackDoctor = (): DoctorData | null => {
    let parsed: any = user;
    if (!parsed) {
      const savedHospitalUser = localStorage.getItem('sante_hospital_user');
      if (savedHospitalUser) {
        try { parsed = JSON.parse(savedHospitalUser); } catch (e) {}
      }
    }
    if (!parsed) {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try { parsed = JSON.parse(savedUser); } catch (e) {}
      }
    }
    if (parsed) {
      return {
        id: String(parsed.id || '4'),
        name: parsed.name || 'Dr. Praticien Santé+',
        email: parsed.email || 'medecin@santeplus.bj',
        phone: parsed.phone || '+229 01 97 00 00 00',
        specialty: parsed.specialty || 'Médecine Générale',
        npi: parsed.npi || 'BJ-MED-0004',
        hospitalId: parsed.hospitalId || 'hz-calavi',
        hospitalName: parsed.hospitalName || "Hôpital de Zone d'Abomey-Calavi & Sô-Ava",
        avatar: parsed.avatar || '',
      };
    }
    return null;
  };

  const initialWorkspace = readDoctorWorkspace();
  const [doctorData, setDoctorDataState] = useState<DoctorData | null>(
    (initialWorkspace.doctorData as DoctorData | null) || getFallbackDoctor()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [workspaceKey, setWorkspaceKey] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeDoctorWorkspace((workspace) => {
      if (workspace.doctorData) {
        setDoctorDataState(workspace.doctorData as DoctorData);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    loadDoctorData();
  }, [user]);

  const loadDoctorData = async () => {
    const fallback = getFallbackDoctor();
    try {
      setLoading(false);
      setError('');

      let profile: any = null;
      try {
        profile = await getDoctorProfile();
      } catch (e) {
        console.warn('Profile fetch failed, using fallback user data:', e);
      }

      const nextDoctorData: DoctorData = {
        id: String(profile?.id || fallback?.id || '4'),
        name: profile?.name || fallback?.name || 'Dr. Praticien Santé+',
        email: profile?.email || fallback?.email || 'medecin@santeplus.bj',
        phone: profile?.phone || fallback?.phone || '+229 01 97 00 00 00',
        specialty: profile?.specialty || fallback?.specialty || 'Médecine Générale',
        npi: profile?.npi || fallback?.npi || 'BJ-MED-0004',
        hospitalId: profile?.hospitalId || fallback?.hospitalId || 'hz-calavi',
        hospitalName: profile?.hospitalName || fallback?.hospitalName || "Hôpital de Zone d'Abomey-Calavi & Sô-Ava",
        avatar: profile?.avatar || fallback?.avatar || '',
      };

      setDoctorDataState(nextDoctorData);
      writeDoctorWorkspace({ activeModule: null, doctorData: nextDoctorData });
    } catch (err) {
      if (fallback) {
        setDoctorDataState(fallback);
      } else {
        setError('Erreur lors du chargement des données');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !doctorData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#00D26A] to-[#067A45]">
        <div className="text-white text-center">
          <Activity className="w-16 h-16 animate-pulse mx-auto mb-4" />
          <p className="text-xl">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (error && !doctorData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center">
          <p className="text-red-500 text-lg mb-4">{error || 'Erreur lors du chargement'}</p>
          <button
            onClick={loadDoctorData}
            className="bg-[#00D26A] text-white px-6 py-2 rounded-lg hover:bg-[#067A45]"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="role-dashboard w-full max-w-7xl mx-auto space-y-4">
      <DoctorHeader doctorData={doctorData} onLogout={onLogout} onDashboard={() => setWorkspaceKey(k => k + 1)} />
      <ClinicalWorkspace key={workspaceKey} doctorData={doctorData} />
    </div>
  );
}
