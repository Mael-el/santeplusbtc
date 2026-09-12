// ============================================================================
// SERVICE API - MÉDECIN
// Centralise tous les appels HTTP vers le backend pour le tableau de bord médecin
// ============================================================================

const API_BASE = '/api/doctors';

// Helper pour obtenir le token JWT depuis le localStorage
function getAuthToken(): string | null {
  return localStorage.getItem('sante_hospital_token') || localStorage.getItem('sante_access_token');
}

// Helper pour les headers authentifiés
function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Helper générique pour les requêtes API
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  const responseText = await res.text();
  let data: any = null;
  if (responseText.trim()) {
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`Réponse serveur invalide (${res.status})`);
    }
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || `Erreur ${res.status}`);
  }

  if (!data) throw new Error(`Réponse serveur vide (${res.status})`);

  return data;
}

// ============================================================================
// TYPES
// ============================================================================

export interface DoctorProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  npi: string;
  hospitalId: string;
  hospitalName: string;
  avatar: string;
  licenseNumber: string;
  yearsExperience: number;
  consultationFee: number;
  rating: number;
  reviewsCount: number;
  isAvailable: boolean;
  nextAvailableSlot: string;
}

export interface DoctorStats {
  patientsToday: number;
  patientsTotal: number;
  consultationsTotal: number;
  prescriptionsActive: number;
  appointmentsScheduled: number;
  appointmentsCompleted: number;
  averageConsultationTime: number;
  patientSatisfactionRate: number;
  revenue: {
    today: number;
    thisMonth: number;
    currency: string;
    satoshis: number;
  };
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  blood: string;
  allergies?: string;
  consultations: number;
  lastVisit: string;
  npi?: string;
  status: 'regular' | 'new' | 'urgent';
}

export interface Appointment {
  id: string;
  time: string;
  patientName: string;
  patientId: string;
  blood: string;
  allergies?: string;
  status: 'waiting' | 'ongoing' | 'completed' | 'cancelled';
}

export interface ConsultationPayload {
  patientId: string;
  patientName?: string;
  doctorId?: string;
  doctorName?: string;
  diagnostic: string;
  notes?: string;
  prescription: {
    medication: string;
    dosage: string;
    frequency: string;
  };
}

export interface ConsultationDraft {
  id: string;
  patientId: string;
  patientName: string;
  payload: Record<string, string>;
  status: 'DRAFT' | 'VALIDATED';
  updatedAt: string;
}

export interface ConsultationResult {
  id: string;
  timestamp: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  diagnostic: string;
  prescription: string;
  notes: string;
  blockchainHash: string;
  ipfsCid?: string;
  ipfsGatewayUrl?: string;
  doctorSignature?: string;
  doctorLicense?: string;
  status: string;
}

export interface AuditLog {
  id: string;
  date: string;
  time: string;
  action: string;
  patientName: string;
  doctorName: string;
  txHash: string;
  status: string;
  details: string;
}

export interface Prescription {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  patientName: string;
  date: string;
  status: 'active' | 'completed' | 'cancelled';
}

export interface PatientDossier {
  patientId: string;
  patientName: string;
  age: number;
  blood: string;
  allergies: string;
  consultations: Array<{
    id: string;
    date: string;
    time: string;
    doctorName: string;
    hospitalName: string;
    reason: string;
    diagnostic: string;
    prescription: string;
    attachments: string[];
    blockchainHash: string;
  }>;
  prescriptions: Array<{
    id: string;
    medication: string;
    dosage: string;
    frequency: string;
    date: string;
    status: string;
  }>;
  vaccines: any[];
  bloodDonations: any[];
  documents: any[];
  appointments?: any[];
}

// ============================================================================
// ENDPOINTS
// ============================================================================

/** Récupère le profil du médecin connecté */
export async function getDoctorProfile(): Promise<DoctorProfile> {
  const res = await apiFetch<{ success: boolean; data: DoctorProfile }>('/profile');
  return res.data;
}

/** Récupère les statistiques du médecin */
export async function getDoctorStats(): Promise<DoctorStats> {
  const res = await apiFetch<{ success: boolean; data: DoctorStats }>('/stats');
  return res.data;
}

/** Récupère la liste des patients du médecin */
export async function getDoctorPatients(): Promise<Patient[]> {
  const res = await apiFetch<{ success: boolean; data: Patient[]; count: number }>('/patients');
  return res.data;
}

/** Identifie un patient par email ou NPI et l'ajoute au périmètre du médecin. */
export async function addDoctorPatient(identifier: string): Promise<Patient> {
  const res = await apiFetch<{ success: boolean; data: Patient }>('/patients/access', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
  return res.data;
}

/** Crée une fiche patient temporaire pour une prise en charge urgente. */
export async function createAnonymousPatient(): Promise<Patient> {
  const res = await apiFetch<{ success: boolean; data: Patient }>('/patients/anonymous', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return res.data;
}

/** Récupère les rendez-vous du médecin (aujourd'hui) */
export async function getDoctorAppointments(date?: string): Promise<{
  appointments: Appointment[];
  date: string;
}> {
  const query = date ? `?date=${date}` : '';
  const res = await apiFetch<{ success: boolean; data: Appointment[]; date: string }>(`/appointments${query}`);
  return { appointments: res.data, date: res.date };
}

/** Met à jour le statut d'un rendez-vous */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'waiting' | 'ongoing' | 'completed' | 'cancelled'
): Promise<Appointment> {
  const res = await apiFetch<{ success: boolean; data: Appointment }>(
    `/appointments/${appointmentId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }
  );
  return res.data;
}

/** Enregistre une nouvelle consultation */
export async function saveConsultation(payload: ConsultationPayload): Promise<ConsultationResult> {
  const body = {
    patientId: payload.patientId,
    patientName: payload.patientName,
    diagnostic: payload.diagnostic,
    notes: payload.notes,
    prescription: `${payload.prescription.medication} ${payload.prescription.dosage} ${payload.prescription.frequency}`,
  };
  const res = await apiFetch<{ success: boolean; data: ConsultationResult; message: string }>(
    '/consultation',
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  return res.data;
}

export async function saveConsultationDraft(payload: {
  draftId?: string;
  patientId: string;
  patientName: string;
  payload: Record<string, string>;
}): Promise<ConsultationDraft> {
  const res = await apiFetch<{ success: boolean; data: ConsultationDraft }>('/consultation/draft', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function getConsultationDraft(patientId: string): Promise<ConsultationDraft | null> {
  const res = await apiFetch<{ success: boolean; data: ConsultationDraft | null }>(`/consultation/draft/${patientId}`);
  return res.data;
}

export async function validateConsultationDraft(draftId: string): Promise<ConsultationResult> {
  const res = await apiFetch<{ success: boolean; data: ConsultationResult }>('/consultation', {
    method: 'POST',
    body: JSON.stringify({ draftId }),
  });
  return res.data;
}

/** Récupère le dossier médical d'un patient */
export async function getPatientDossier(patientId: string): Promise<PatientDossier> {
  const res = await apiFetch<{ success: boolean; data: PatientDossier }>(
    `/patient/${patientId}/dossier`
  );
  return res.data;
}

/** Récupère les logs d'audit (blockchain) du médecin */
export async function getAuditLogs(): Promise<AuditLog[]> {
  const res = await apiFetch<{ success: boolean; data: AuditLog[]; count: number }>('/audit-logs');
  return res.data;
}

/** Récupère les prescriptions du médecin */
export async function getDoctorPrescriptions(): Promise<Prescription[]> {
  const res = await apiFetch<{ success: boolean; data: Prescription[] }>('/prescriptions');
  return res.data;
}

/** Met à jour le profil du médecin */
export async function updateDoctorProfile(
  updates: Partial<Pick<DoctorProfile, 'phone' | 'isAvailable' | 'consultationFee'>>
): Promise<DoctorProfile> {
  const res = await apiFetch<{ success: boolean; data: DoctorProfile }>('/profile', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return res.data;
}

/** Ajoute un créneau dans l'agenda */
export async function addAppointmentSlot(slot: {
  date: string;
  time: string;
  patientName?: string;
  patientId?: string;
}): Promise<Appointment> {
  const res = await apiFetch<{ success: boolean; data: Appointment }>('/appointments', {
    method: 'POST',
    body: JSON.stringify(slot),
  });
  return res.data;
}
