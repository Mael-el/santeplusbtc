import express, { Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { ipfsService } from '../services/ipfs.service';
import { dbService } from '../services/db.service';
import { publishRealtimeEvent } from '../services/realtime.service';
import { resolvePatientIdentity } from '../services/identity.service';
import { getMedicalRecord, saveMedicalRecord } from '../services/medical-record.service';

const router = express.Router();

// ============================================================================
// BASE DE DONNÉES EN MÉMOIRE (synchronisée avec data_db.json)
// ============================================================================

const DB_FILE = path.join(process.cwd(), 'data_db.json');

// Données persistantes pour les médecins (stockées dans data_db.json ou PostgreSQL)
let DOCTOR_CONSULTATIONS_DB: any[] = [];
let DOCTOR_CONSULTATION_DRAFTS_DB: any[] = [];
let DOCTOR_APPOINTMENTS_DB: any[] = [];
let DOCTOR_PATIENTS_DB: any[] = [];
let DOCTOR_PRESCRIPTIONS_DB: any[] = [];
let DOCTOR_AUDIT_LOGS_DB: any[] = [];

// Profils médecin (indexés par doctorId)
let DOCTOR_PROFILES_DB: Record<string, any> = {};

// Helper: génère une empreinte cryptographique SHA-256 réelle
function generateBlockchainHash(data: string): string {
  return '0x' + crypto.createHash('sha256').update(data).digest('hex');
}

// Helper: sauvegarde les données dans data_db.json
function saveDocumentData() {
  if (process.env.NODE_ENV === 'production') return;
  try {
    let existing: any = {};
    if (fs.existsSync(DB_FILE)) {
      existing = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
    fs.writeFileSync(DB_FILE, JSON.stringify({
      ...existing,
      DOCTOR_CONSULTATIONS_DB,
      DOCTOR_CONSULTATION_DRAFTS_DB,
      DOCTOR_APPOINTMENTS_DB,
      DOCTOR_PATIENTS_DB,
      DOCTOR_PRESCRIPTIONS_DB,
      DOCTOR_AUDIT_LOGS_DB,
      DOCTOR_PROFILES_DB,
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save doctor data:', err);
  }
}

// Charge les données depuis data_db.json si elles existent
try {
  if (process.env.NODE_ENV !== 'production' && fs.existsSync(DB_FILE)) {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (raw.DOCTOR_CONSULTATIONS_DB) DOCTOR_CONSULTATIONS_DB = raw.DOCTOR_CONSULTATIONS_DB;
    if (raw.DOCTOR_CONSULTATION_DRAFTS_DB) DOCTOR_CONSULTATION_DRAFTS_DB = raw.DOCTOR_CONSULTATION_DRAFTS_DB;
    if (raw.DOCTOR_APPOINTMENTS_DB) DOCTOR_APPOINTMENTS_DB = raw.DOCTOR_APPOINTMENTS_DB;
    if (raw.DOCTOR_PATIENTS_DB) DOCTOR_PATIENTS_DB = raw.DOCTOR_PATIENTS_DB;
    if (raw.DOCTOR_PRESCRIPTIONS_DB) DOCTOR_PRESCRIPTIONS_DB = raw.DOCTOR_PRESCRIPTIONS_DB;
    if (raw.DOCTOR_AUDIT_LOGS_DB) DOCTOR_AUDIT_LOGS_DB = raw.DOCTOR_AUDIT_LOGS_DB;
    if (raw.DOCTOR_PROFILES_DB) DOCTOR_PROFILES_DB = raw.DOCTOR_PROFILES_DB;
  }
} catch (e) {
  console.log('Starting with default doctor data');
}

// ============================================================================
// DOCTOR ENDPOINTS - Page Médecin
// ============================================================================

// GET /api/doctors/profile - Récupérer le profil du médecin
router.get('/profile', requireAuth, requireRole('doctor', 'admin'), (req: any, res: Response) => {
  try {
    const doctorId = String(req.userId);
    if (dbService.getStatus().connected) {
      dbService.query<any>(
        `SELECT u.id, u.email, u.phone, d.first_name || ' ' || d.last_name AS name,
                d.specialty, d.npi, d.hospital_id AS "hospitalId",
                COALESCE(dp.hospital_name, h.name, '') AS "hospitalName",
                COALESCE(dp.avatar, '') AS avatar,
                COALESCE(dp.consultation_fee, d.consultation_fee) AS "consultationFee",
                COALESCE(dp.is_available, d.is_active) AS "isAvailable"
         FROM users u
         LEFT JOIN doctors d ON d.user_id = u.id
         LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
         LEFT JOIN hospitals h ON h.id = d.hospital_id
         WHERE u.id = $1
         LIMIT 1`,
        [req.userId]
      ).then(result => {
        const profile = result?.rows[0];
        if (!profile) return res.status(404).json({ success: false, error: 'Profil médecin introuvable' });
        return res.json({ success: true, data: profile });
      }).catch(error => res.status(500).json({ success: false, error: String(error) }));
      return;
    }
    const profile = DOCTOR_PROFILES_DB[doctorId] || DOCTOR_PROFILES_DB['2'];

    res.json({
      success: true,
      data: { ...profile, id: doctorId },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// PATCH /api/doctors/profile - Mettre à jour le profil du médecin
router.patch('/profile', requireAuth, requireRole('doctor', 'admin'), (req: any, res: Response) => {
  try {
    const doctorId = String(req.userId);
    const { phone, isAvailable, consultationFee, specialty } = req.body;

    if (dbService.getStatus().connected) {
      dbService.query(
        `INSERT INTO doctor_profiles (user_id, phone, specialty, consultation_fee, is_available)
         VALUES ($1, $2, $3, COALESCE($4, 5000), COALESCE($5, TRUE))
         ON CONFLICT (user_id) DO UPDATE SET
           phone = COALESCE($2, doctor_profiles.phone),
           specialty = COALESCE($3, doctor_profiles.specialty),
           consultation_fee = COALESCE($4, doctor_profiles.consultation_fee),
           is_available = COALESCE($5, doctor_profiles.is_available),
           updated_at = CURRENT_TIMESTAMP`,
        [req.userId, phone || null, specialty || null, consultationFee ?? null, isAvailable ?? null]
      ).then(() => dbService.query<any>(
        `SELECT u.id, u.email, u.phone, d.first_name || ' ' || d.last_name AS name,
                d.specialty, d.npi, d.hospital_id AS "hospitalId",
                COALESCE(dp.hospital_name, h.name, '') AS "hospitalName",
                COALESCE(dp.avatar, '') AS avatar,
                COALESCE(dp.consultation_fee, d.consultation_fee) AS "consultationFee",
                COALESCE(dp.is_available, d.is_active) AS "isAvailable"
         FROM users u LEFT JOIN doctors d ON d.user_id = u.id
         LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
         LEFT JOIN hospitals h ON h.id = d.hospital_id
         WHERE u.id = $1 LIMIT 1`, [req.userId]
      )).then(result => res.json({ success: true, data: result?.rows[0] })).catch(error => res.status(500).json({ success: false, error: String(error) }));
      return;
    }

    if (!DOCTOR_PROFILES_DB[doctorId]) {
      DOCTOR_PROFILES_DB[doctorId] = { ...DOCTOR_PROFILES_DB['2'], id: doctorId };
    }

    const profile = DOCTOR_PROFILES_DB[doctorId];
    if (phone !== undefined) profile.phone = phone;
    if (isAvailable !== undefined) profile.isAvailable = isAvailable;
    if (consultationFee !== undefined) profile.consultationFee = Number(consultationFee);
    if (specialty !== undefined) profile.specialty = specialty;

    saveDocumentData();

    // Ajouter log d'audit
    const log = {
      id: `log-${Date.now()}`,
      doctorId,
      date: new Date().toLocaleDateString('fr-FR'),
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      action: 'Profil mis à jour',
      patientName: '-',
      doctorName: profile.name,
      txHash: generateBlockchainHash(`profile-update-${doctorId}`),
      status: 'confirmed',
      details: `Mise à jour du profil médecin`,
    };
    DOCTOR_AUDIT_LOGS_DB.unshift(log);

    res.json({ success: true, data: profile });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// GET /api/doctors/stats - Statistiques du médecin
router.get('/stats', requireAuth, requireRole('doctor', 'admin'), (req: any, res: Response) => {
  try {
    const doctorId = String(req.userId);
    const today = new Date().toISOString().split('T')[0];

    if (dbService.getStatus().connected) {
      Promise.all([
        dbService.query<any>('SELECT COUNT(*)::int AS count FROM doctor_appointments WHERE doctor_user_id = $1 AND date = $2', [req.userId, today]),
        dbService.query<any>(`SELECT COUNT(*)::int AS count FROM doctor_consultations WHERE doctor_user_id = $1`, [req.userId]),
        dbService.query<any>(`SELECT COUNT(*)::int AS count FROM doctor_prescriptions WHERE doctor_user_id = $1 AND status = 'active'`, [req.userId]),
        dbService.query<any>(`SELECT COUNT(*)::int AS count FROM doctor_patients WHERE doctor_user_id = $1`, [req.userId]),
      ]).then(([appointments, consultations, prescriptions, patients]) => res.json({ success: true, data: {
        patientsToday: appointments?.rows[0]?.count || 0,
        consultationsTotal: consultations?.rows[0]?.count || 0,
        prescriptionsActive: prescriptions?.rows[0]?.count || 0,
        appointmentsScheduled: appointments?.rows[0]?.count || 0,
        appointmentsCompleted: consultations?.rows[0]?.count || 0,
        averageConsultationTime: 0,
        patientSatisfactionRate: 0,
        revenue: { today: 0, thisMonth: 0, currency: 'XOF', satoshis: 0 },
        patientsTotal: patients?.rows[0]?.count || 0,
      } })).catch(error => res.status(500).json({ success: false, error: String(error) }));
      return;
    }

    // Calcul dynamique depuis les données en mémoire
    const todayAppointments = DOCTOR_APPOINTMENTS_DB.filter(
      (a) => (a.doctorId === doctorId || a.doctorId === '2') && a.date === today
    );
    const patientsToday = todayAppointments.length;
    const consultationsCompleted = todayAppointments.filter((a) => a.status === 'completed').length;
    const waitingCount = todayAppointments.filter((a) => a.status === 'waiting').length;

    const activePrescriptions = DOCTOR_PRESCRIPTIONS_DB.filter(
      (p) => (p.doctorId === doctorId || p.doctorId === '2') && p.status === 'active'
    ).length;

    const stats = {
      patientsToday,
      patientsTotal: DOCTOR_PATIENTS_DB.filter(
        (p) => p.doctorId === doctorId || p.doctorId === '2'
      ).length,
      consultationsTotal: consultationsCompleted,
      prescriptionsActive: activePrescriptions,
      appointmentsScheduled: waitingCount,
      appointmentsCompleted: DOCTOR_CONSULTATIONS_DB.filter((c) => c.doctorId === doctorId).length,
      averageConsultationTime: 15,
      patientSatisfactionRate: 95,
      revenue: {
        today: patientsToday * 5000,
        thisMonth: 0,
        currency: 'XOF',
        satoshis: 7500,
      },
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// GET /api/doctors/patients - Liste des patients du médecin
router.get('/patients', requireAuth, requireRole('doctor', 'admin'), (req: any, res: Response) => {
  try {
    const doctorId = String(req.userId);
    const { search, status } = req.query;

    if (dbService.getStatus().connected) {
      dbService.query<any>(
        `SELECT p.id::text, u.email, p.first_name || ' ' || p.last_name AS name,
                EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth))::int AS age,
                COALESCE(p.blood_type, 'Non renseigné') AS blood,
                COALESCE(p.allergies, 'Aucune') AS allergies, p.npi,
                dp.status, dp.consultations_count AS consultations,
                dp.last_visit AS "lastVisit"
         FROM doctor_patients dp JOIN patients p ON p.id = dp.patient_id
         JOIN users u ON u.id = p.user_id
         WHERE dp.doctor_user_id = $1
           AND ($2::text IS NULL OR u.email ILIKE '%' || $2 || '%' OR p.npi ILIKE '%' || $2 || '%')
           AND ($3::text IS NULL OR $3 = 'all' OR dp.status = $3)
         ORDER BY dp.linked_at DESC`,
        [req.userId, search ? String(search) : null, status ? String(status) : null]
      ).then(result => res.json({ success: true, data: result?.rows || [], count: result?.rows.length || 0 }))
        .catch(error => res.status(500).json({ success: false, error: String(error) }));
      return;
    }

    let patients = DOCTOR_PATIENTS_DB.filter(
      (p) => p.doctorId === doctorId || p.doctorId === '2'
    );

    if (search) {
      patients = patients.filter((p) =>
        p.name.toLowerCase().includes(String(search).toLowerCase())
      );
    }

    if (status && status !== 'all') {
      patients = patients.filter((p) => p.status === status);
    }

    res.json({ success: true, data: patients, count: patients.length });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/doctors/patients/access - Identifier un patient par email ou NPI
router.post('/patients/access', requireAuth, requireRole('doctor', 'admin'), async (req: any, res: Response) => {
  const identifier = typeof req.body.identifier === 'string' ? req.body.identifier.trim() : '';
  if (!identifier || identifier.length > 160) {
    return res.status(400).json({ success: false, error: 'Email ou NPI invalide.' });
  }

  try {
    let patient: any;
    const identity = await resolvePatientIdentity(identifier);
    if (!identity) {
      return res.status(404).json({ success: false, error: 'Patient introuvable.' });
    }

    if (dbService.getStatus().connected) {
      const result = await dbService.query<any>(
        `SELECT p.id, u.email, p.first_name AS "firstName", p.last_name AS "lastName",
                p.npi, p.date_of_birth AS "dateOfBirth", p.gender,
                COALESCE(p.blood_type, 'Non renseigné') AS blood,
                COALESCE(p.allergies, 'Aucune') AS allergies
         FROM patients p
         JOIN users u ON u.id = p.user_id
        WHERE p.id::text = $1::text OR p.npi = $1 OR u.email = $1 OR u.phone = $1
         LIMIT 1`,
        [identity.patientId]
      );
      patient = result?.rows[0];
      if (!patient) {
        return res.status(404).json({ success: false, error: 'Patient introuvable.' });
      }

      await dbService.query(
        `INSERT INTO patient_consents (patient_id, doctor_id, purpose, status, expires_at)
         VALUES ($1, (SELECT id FROM doctors WHERE user_id = $2 LIMIT 1), 'prise_en_charge', 'active', CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
        [patient.id, req.userId]
      );
      await dbService.query(
        `INSERT INTO doctor_patients (doctor_user_id, patient_id, status)
         VALUES ($1, $2, 'new')
         ON CONFLICT (doctor_user_id, patient_id) DO UPDATE SET status = 'new', linked_at = CURRENT_TIMESTAMP`,
        [req.userId, patient.id]
      );
    } else if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      const profiles = raw.PATIENTS_DB || {};
      const profile = profiles[identity.email];
      patient = {
        id: identity.patientId,
        email: identity.email,
        phone: identity.phone,
        firstName: profile?.name?.split(' ')[0] || 'Patient',
        lastName: profile?.name?.split(' ').slice(1).join(' ') || '',
        npi: identity.npi,
        blood: profile?.bloodGroup || 'Non renseigné',
        allergies: profile?.allergies || 'Aucune',
      };
    } else {
      return res.status(503).json({ success: false, error: 'Base de patients indisponible.' });
    }

    const linkedPatient = {
      id: String(patient.id),
      doctorId: String(req.userId),
      name: `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || patient.email,
      age: patient.dateOfBirth ? Math.max(0, new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()) : 0,
      blood: patient.blood || 'Non renseigné',
      allergies: patient.allergies || 'Aucune',
      npi: patient.npi,
      status: 'new',
      consultations: 0,
      lastVisit: '',
      email: patient.email,
    };
    if (!dbService.getStatus().connected || process.env.NODE_ENV !== 'production') {
      DOCTOR_PATIENTS_DB = [
      linkedPatient,
      ...DOCTOR_PATIENTS_DB.filter(item => !(item.id === linkedPatient.id && item.doctorId === linkedPatient.doctorId)),
      ];
    }
    saveDocumentData();
    publishRealtimeEvent({ type: 'created', entity: 'patient', entityId: linkedPatient.id });

    return res.status(201).json({ success: true, data: linkedPatient });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Impossible d’enregistrer l’accès patient.' });
  }
});

// POST /api/doctors/patients/anonymous - Créer une fiche temporaire d'urgence
router.post('/patients/anonymous', requireAuth, requireRole('doctor'), async (req: any, res: Response) => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const patientId = `anonymous-${suffix}`;
  const npi = `URG${suffix.slice(-10)}`;

  try {
    if (dbService.getStatus().connected) {
      const email = `${patientId}@urgence.santeplus.bj`;
      const phone = `URG-${suffix}`;
      const passwordHash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
      const pinHash = bcrypt.hashSync(crypto.randomBytes(12).toString('hex'), 10);
      const qrHash = crypto.createHash('sha256').update(`${patientId}-${npi}`).digest('hex');
      const userResult = await dbService.query<{ id: number }>(
        `INSERT INTO users (email, phone, password_hash, role)
         VALUES ($1, $2, $3, 'patient') RETURNING id`,
        [email, phone, passwordHash]
      );
      const userId = userResult?.rows[0]?.id;
      if (!userId) {
        return res.status(500).json({ success: false, error: 'Utilisateur urgence non créé.' });
      }
      const patientResult = await dbService.query<any>(
        `INSERT INTO patients
         (user_id, first_name, last_name, date_of_birth, gender, npi, qr_code_hash, pin_hash)
         VALUES ($1, 'Patient', 'Urgence', CURRENT_DATE, 'non_renseigne', $2, $3, $4)
         RETURNING id::text AS id, first_name || ' ' || last_name AS name,
                   0 AS age, COALESCE(blood_type, 'Non renseigné') AS blood,
                   COALESCE(allergies, 'Non renseignées') AS allergies, npi`,
        [userId, npi, qrHash, pinHash]
      );
      const patient = patientResult?.rows[0];
      if (!patient) {
        return res.status(500).json({ success: false, error: 'Dossier urgence non créé.' });
      }
      await dbService.query(
        `INSERT INTO patient_consents (patient_id, doctor_id, purpose, status, expires_at)
         VALUES ($1, (SELECT id FROM doctors WHERE user_id = $2 LIMIT 1), 'urgence', 'active', CURRENT_TIMESTAMP + INTERVAL '24 hours')`,
        [patient.id, req.userId]
      );
      await dbService.query(
        `INSERT INTO doctor_patients (doctor_user_id, patient_id, status)
         VALUES ($1, $2, 'urgent')
         ON CONFLICT (doctor_user_id, patient_id) DO UPDATE SET status = 'urgent', linked_at = CURRENT_TIMESTAMP`,
        [req.userId, patient.id]
      );
      const linkedPatient = { ...patient, consultations: 0, lastVisit: '', status: 'urgent' };
      publishRealtimeEvent({ type: 'created', entity: 'patient', entityId: String(patient.id) });
      return res.status(201).json({ success: true, data: linkedPatient });
    }

    const linkedPatient = {
      id: patientId,
      name: 'Patient urgence',
      age: 0,
      blood: 'Non renseigné',
      allergies: 'Non renseignées',
      npi,
      consultations: 0,
      lastVisit: '',
      status: 'urgent',
      doctorId: String(req.userId),
    };
    DOCTOR_PATIENTS_DB.unshift(linkedPatient);
    saveDocumentData();
    publishRealtimeEvent({ type: 'created', entity: 'patient', entityId: patientId });
    return res.status(201).json({ success: true, data: linkedPatient });
  } catch (error) {
    console.error('[Doctor] Création patient urgence échouée:', error);
    return res.status(500).json({ success: false, error: 'Impossible de créer la fiche urgence.' });
  }
});

// GET /api/doctors/appointments - Rendez-vous du médecin
router.get('/appointments', requireAuth, requireRole('doctor', 'admin'), (req: any, res: Response) => {
  try {
    const doctorId = String(req.userId);
    const date = String(req.query.date || new Date().toISOString().split('T')[0]);

    if (dbService.getStatus().connected) {
      dbService.query<any>(
        `SELECT id, TO_CHAR(date, 'YYYY-MM-DD') AS date, time_slot AS time,
                patient_name AS "patientName", COALESCE(patient_id::text, '') AS "patientId", status
         FROM doctor_appointments WHERE doctor_user_id = $1 AND date = $2 ORDER BY time_slot`,
        [req.userId, date]
      ).then(result => res.json({ success: true, data: result?.rows || [], date }))
        .catch(error => res.status(500).json({ success: false, error: String(error) }));
      return;
    }

    const appointments = DOCTOR_APPOINTMENTS_DB.filter(
      (a) => (a.doctorId === doctorId || a.doctorId === '2') && a.date === date
    );

    res.json({
      success: true,
      data: appointments,
      date,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/doctors/appointments - Ajouter un créneau de RDV
router.post('/appointments', requireAuth, requireRole('doctor', 'admin'), (req: any, res: Response) => {
  try {
    const doctorId = String(req.userId);
    const { date, time, patientName, patientId } = req.body;

    if (!date || !time) {
      return res.status(400).json({ success: false, error: 'Date et heure requises' });
    }

    if (dbService.getStatus().connected) {
      const id = `dr-apt-${Date.now()}`;
      dbService.query<any>(
        `INSERT INTO doctor_appointments (id, doctor_user_id, patient_id, date, time_slot, patient_name, status)
         VALUES ($1, $2, NULLIF($3, '')::integer, $4, $5, $6, 'waiting')
         RETURNING id, TO_CHAR(date, 'YYYY-MM-DD') AS date, time_slot AS time,
                   patient_name AS "patientName", COALESCE(patient_id::text, '') AS "patientId", status`,
        [id, req.userId, patientId || '', date, time, patientName || 'À définir']
      ).then(result => {
        publishRealtimeEvent({ type: 'created', entity: 'appointment', entityId: id });
        return res.status(201).json({ success: true, data: result?.rows[0] });
      })
        .catch(error => res.status(500).json({ success: false, error: String(error) }));
      return;
    }

    const newAppointment = {
      id: `dr-apt-${Date.now()}`,
      doctorId,
      date,
      time,
      patientName: patientName || 'À définir',
      patientId: patientId || null,
      status: 'waiting',
    };

    DOCTOR_APPOINTMENTS_DB.push(newAppointment);
    saveDocumentData();
    publishRealtimeEvent({ type: 'created', entity: 'appointment', entityId: newAppointment.id });

    res.status(201).json({ success: true, data: newAppointment });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// PATCH /api/doctors/appointments/:id/status - Mettre à jour le statut d'un RDV
router.patch('/appointments/:id/status', requireAuth, requireRole('doctor', 'admin'), (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['waiting', 'ongoing', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Statut invalide' });
    }

    if (dbService.getStatus().connected) {
      dbService.query<any>(
        `UPDATE doctor_appointments SET status = $1 WHERE id = $2 AND doctor_user_id = $3 RETURNING id`,
        [status, id, req.userId]
      ).then(result => {
        if (!result?.rows[0]) return res.status(404).json({ success: false, error: 'Rendez-vous introuvable' });
        publishRealtimeEvent({ type: 'updated', entity: 'appointment', entityId: id });
        return res.json({ success: true, data: { id, status } });
      }).catch(error => res.status(500).json({ success: false, error: String(error) }));
      return;
    }

    const appointment = DOCTOR_APPOINTMENTS_DB.find((a) => a.id === id);
    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Rendez-vous introuvable' });
    }

    appointment.status = status;
    saveDocumentData();

    // Log d'audit automatique
    const doctorId = String(req.userId);
    const profile = DOCTOR_PROFILES_DB[doctorId] || DOCTOR_PROFILES_DB['2'];
    const actionLabel = status === 'completed' ? 'Consultation terminée' : status === 'ongoing' ? 'Consultation démarrée' : 'RDV mis à jour';

    const log = {
      id: `log-${Date.now()}`,
      doctorId,
      date: new Date().toLocaleDateString('fr-FR'),
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      action: actionLabel,
      status: 'confirmed',
      details: `Statut du RDV ${id} mis à jour: ${status}`,
    };
    DOCTOR_AUDIT_LOGS_DB.unshift(log);
    saveDocumentData();
    publishRealtimeEvent({ type: 'updated', entity: 'appointment', entityId: id });

    res.json({ success: true, data: appointment });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// POST /api/doctors/consultation/draft - Sauvegarder un brouillon privé
router.post('/consultation/draft', requireAuth, requireRole('doctor'), async (req: any, res: Response) => {
  const { draftId, patientId, patientName, payload } = req.body;
  if (!patientId || !patientName || !payload || typeof payload !== 'object') {
    return res.status(400).json({ success: false, error: 'Patient et contenu du brouillon requis.' });
  }

  const id = draftId || `DRAFT-${req.userId}-${patientId}`;
  try {
    const patientIdentity = await resolvePatientIdentity(String(patientId));
    if (patientIdentity) {
      const currentRecord = await getMedicalRecord(patientIdentity.identityUuid, true);
      await saveMedicalRecord(patientIdentity.identityUuid, {
        ...(currentRecord || {}),
        identityUuid: patientIdentity.identityUuid,
        history: [
          ...(currentRecord?.history || []),
          { id, patientId, payload, status: 'DRAFT', updatedAt: new Date().toISOString() },
        ],
      }, 'DRAFT', Number(req.userId));
    }
    if (dbService.getStatus().connected) {
      const result = await dbService.query<any>(
        `INSERT INTO doctor_consultation_drafts
         (id, doctor_user_id, patient_id, patient_name, payload, status, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, 'DRAFT', CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET payload = $5::jsonb, patient_name = $4,
           status = 'DRAFT', updated_at = CURRENT_TIMESTAMP, validated_at = NULL
         WHERE doctor_consultation_drafts.doctor_user_id = $2
         RETURNING id, patient_id AS "patientId", patient_name AS "patientName",
                   payload, status, updated_at AS "updatedAt"`,
        [id, req.userId, patientId, patientName, JSON.stringify(payload)]
      );
      return res.json({ success: true, data: result?.rows[0] });
    }

    const draft = { id, doctorId: String(req.userId), patientId: String(patientId), patientName, payload, status: 'DRAFT', updatedAt: new Date().toISOString() };
    DOCTOR_CONSULTATION_DRAFTS_DB = [draft, ...DOCTOR_CONSULTATION_DRAFTS_DB.filter(item => item.id !== id)];
    saveDocumentData();
    return res.json({ success: true, data: draft });
  } catch (error) {
    console.error('[Doctor] Brouillon non sauvegardé:', error);
    return res.status(500).json({ success: false, error: 'Impossible de sauvegarder le brouillon.' });
  }
});

router.get('/consultation/draft/:patientId', requireAuth, requireRole('doctor'), async (req: any, res: Response) => {
  try {
    if (dbService.getStatus().connected) {
      const result = await dbService.query<any>(
        `SELECT id, patient_id AS "patientId", patient_name AS "patientName", payload, status,
                updated_at AS "updatedAt"
         FROM doctor_consultation_drafts
         WHERE doctor_user_id = $1 AND patient_id = $2 AND status = 'DRAFT'
         ORDER BY updated_at DESC LIMIT 1`,
        [req.userId, req.params.patientId]
      );
      return res.json({ success: true, data: result?.rows[0] || null });
    }
    const draft = DOCTOR_CONSULTATION_DRAFTS_DB.find(item => item.doctorId === String(req.userId) && item.patientId === String(req.params.patientId) && item.status === 'DRAFT') || null;
    return res.json({ success: true, data: draft });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Impossible de charger le brouillon.' });
  }
});

// POST /api/doctors/consultation - Valider et publier une consultation
router.post('/consultation', requireAuth, requireRole('doctor'), async (req: any, res: Response) => {
  try {
    let {
      patientId,
      patientName,
      diagnostic,
      prescription,
      notes,
      draftId,
    } = req.body;

    let draft: any = null;
    if (draftId) {
      if (dbService.getStatus().connected) {
        const draftResult = await dbService.query<any>(
          `SELECT id, patient_id AS "patientId", patient_name AS "patientName", payload, status
           FROM doctor_consultation_drafts WHERE id = $1 AND doctor_user_id = $2 LIMIT 1`,
          [draftId, req.userId]
        );
        draft = draftResult?.rows[0];
      } else {
        draft = DOCTOR_CONSULTATION_DRAFTS_DB.find(item => item.id === draftId && item.doctorId === String(req.userId));
      }
      if (!draft || draft.status !== 'DRAFT') return res.status(409).json({ success: false, error: 'Brouillon introuvable ou déjà validé.' });
      const payload = draft.payload || {};
      patientId = draft.patientId;
      patientName = draft.patientName;
      diagnostic = [payload.diagnosis, payload.secondaryDiagnosis].filter(Boolean).join(' | ');
      prescription = [payload.medication, payload.dosage, payload.frequency].filter(Boolean).join(' ');
      notes = payload.notes || '';
    }

    const doctorId = String(req.userId);
    if (!patientId || !patientName || !diagnostic) {
      return res.status(400).json({ success: false, error: 'Patient, diagnostic requis' });
    }

    if (dbService.getStatus().connected) {
      const consent = await dbService.query(
        `SELECT 1 FROM patient_consents pc
         JOIN patients p ON p.id = pc.patient_id
         JOIN doctors d ON d.id = pc.doctor_id
         WHERE p.id = $1 AND d.user_id = $2 AND pc.status = 'active'
           AND pc.expires_at > CURRENT_TIMESTAMP
         LIMIT 1`,
        [patientId, req.userId]
      );
      if (!consent?.rows[0]) {
        return res.status(403).json({ success: false, error: 'Patient consent required' });
      }
    }
    const profile = DOCTOR_PROFILES_DB[doctorId] || DOCTOR_PROFILES_DB['2'];
    const doctorLicense = profile?.licenseNumber || 'MED-BJ-2024-8831';
    const timestamp = new Date().toISOString();
    const blockchainHash = generateBlockchainHash(`cons-${patientId}-${diagnostic}-${Date.now()}`);
    const digitalSignature = `SIG-DR-${doctorId}-${crypto.createHash('sha256').update(doctorId + patientId + diagnostic + Date.now()).digest('hex').slice(0, 24)}`;

    // Épinglage automatique sur IPFS (Pinata ou fallback décentralisé certifié)
    let ipfsResult: any = null;
    try {
      ipfsResult = await ipfsService.pinJSON({
        platform: 'Santé+ Bénin',
        doctorId,
        doctorName: profile?.name || 'Dr. Sossou',
        doctorLicense,
        digitalSignature,
        patientId,
        patientName,
        diagnostic,
        prescription,
        notes: notes || '',
        createdAt: timestamp,
        blockchainHash
      }, `Ordonnance_${patientName.replace(/\s+/g, '_')}_${Date.now()}`);
    } catch (ipfsErr) {
      console.error('IPFS encryption/pinning error:', ipfsErr);
      return res.status(503).json({
        success: false,
        error: 'Archivage médical sécurisé indisponible. La consultation n’a pas été enregistrée.',
      });
    }

    const ipfsCid = ipfsResult.cid;
    const ipfsGatewayUrl = ipfsResult.gatewayUrl;

    const consultation = {
      id: `CONS-${Date.now()}`,
      timestamp,
      date: new Date().toLocaleDateString('fr-FR'),
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      doctorId,
      doctorName: profile?.name || 'Dr. Sossou',
      doctorLicense,
      doctorSignature: digitalSignature,
      hospitalName: profile?.hospitalName || 'CHD Atlantique',
      patientId,
      patientName,
      diagnostic,
      prescription,
      notes: notes || '',
      blockchainHash,
      ipfsCid,
      ipfsGatewayUrl,
      status: 'confirmed',
    };

    if (dbService.getStatus().connected) {
      await dbService.query(
        `INSERT INTO doctor_consultations
         (id, doctor_user_id, patient_id, patient_name, diagnostic, prescription, notes,
          blockchain_hash, ipfs_cid, ipfs_gateway_url, doctor_signature, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'confirmed')
         ON CONFLICT (id) DO NOTHING`,
        [consultation.id, req.userId, patientId, patientName, diagnostic, prescription || null,
          notes || null, blockchainHash, ipfsCid, ipfsGatewayUrl, digitalSignature]
      );
      await dbService.query(
        `UPDATE doctor_patients SET consultations_count = consultations_count + 1,
                last_visit = CURRENT_DATE, status = 'regular'
         WHERE doctor_user_id = $1 AND patient_id = $2`,
        [req.userId, patientId]
      );
      await dbService.query(
        `INSERT INTO consultations
         (patient_id, doctor_id, consultation_date, motive, anamnesis, clinical_exam,
          vital_signs, diagnosis, treatment, recommendations, status, record_hash)
         VALUES ($1, (SELECT id FROM doctors WHERE user_id = $2 LIMIT 1), $3,
                 $4, $5, $6, $7::jsonb, $8, $9, $10, 'completed', $11)`,
        [
          patientId,
          req.userId,
          timestamp,
          notes?.match(/Motif:([^\n]*)/)?.[1]?.trim() || '',
          notes?.match(/Anamnèse:([^\n]*)/)?.[1]?.trim() || '',
          notes?.match(/Examen:([^\n]*)/)?.[1]?.trim() || '',
          JSON.stringify({ raw: notes || '' }),
          diagnostic,
          prescription || '',
          notes?.match(/Suivi:([^\n]*)/)?.[1]?.trim() || '',
          blockchainHash,
        ]
      );
    } else {
      DOCTOR_CONSULTATIONS_DB.unshift(consultation);
    }

    // Mettre à jour les stats du patient
    const patient = DOCTOR_PATIENTS_DB.find((p) => p.id === patientId);
    if (patient) {
      patient.consultations = (patient.consultations || 0) + 1;
      patient.lastVisit = new Date().toISOString().split('T')[0];
      if (patient.status === 'new') patient.status = 'regular';
    }

    // Créer la prescription si fournie
    if (prescription && dbService.getStatus().connected) {
      await dbService.query(
        `INSERT INTO doctor_prescriptions
         (id, doctor_user_id, patient_id, patient_name, medication, doctor_signature, ipfs_cid)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
        [`rx-${Date.now()}`, req.userId, patientId, patientName, prescription, digitalSignature, ipfsCid]
      );
    } else if (prescription) {
      const newPrescription = {
        id: `rx-${Date.now()}`,
        doctorId,
        doctorSignature: digitalSignature,
        ipfsCid,
        medication: prescription,
        dosage: '',
        frequency: '',
        patientName,
        patientId,
        date: new Date().toISOString().split('T')[0],
        status: 'active',
      };
      DOCTOR_PRESCRIPTIONS_DB.unshift(newPrescription);
    }

    // Log d'audit
    const log = {
      id: `log-${Date.now()}`,
      doctorId,
      date: new Date().toLocaleDateString('fr-FR'),
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      action: 'Consultation enregistrée & signée',
      patientName,
      doctorName: profile?.name || 'Dr. Sossou',
      txHash: consultation.blockchainHash,
      ipfsCid,
      status: 'confirmed',
      details: `Consultation pour ${patientName}: ${diagnostic} (IPFS: ${ipfsCid})`,
    };
    if (dbService.getStatus().connected) {
      await dbService.query(
        `INSERT INTO doctor_audit_logs
         (id, doctor_user_id, action, patient_name, details, tx_hash, ipfs_cid, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed') ON CONFLICT (id) DO NOTHING`,
        [log.id, req.userId, log.action, patientName, log.details, log.txHash, ipfsCid]
      );
    } else {
      DOCTOR_AUDIT_LOGS_DB.unshift(log);
    }

    saveDocumentData();
    if (draftId) {
      if (dbService.getStatus().connected) {
        await dbService.query(`UPDATE doctor_consultation_drafts SET status = 'VALIDATED', validated_at = CURRENT_TIMESTAMP WHERE id = $1 AND doctor_user_id = $2`, [draftId, req.userId]);
      } else {
        const localDraft = DOCTOR_CONSULTATION_DRAFTS_DB.find(item => item.id === draftId && item.doctorId === String(req.userId));
        if (localDraft) { localDraft.status = 'VALIDATED'; localDraft.validatedAt = new Date().toISOString(); }
        saveDocumentData();
      }
    }
    const patientIdentity = await resolvePatientIdentity(patientId);
    const audienceUserIds = [Number(req.userId), ...(patientIdentity ? [patientIdentity.userId] : [])];
    if (patientIdentity) {
      const currentRecord = await getMedicalRecord(patientIdentity.identityUuid, true);
      await saveMedicalRecord(patientIdentity.identityUuid, {
        ...(currentRecord || {}),
        identityUuid: patientIdentity.identityUuid,
        consultations: [
          ...(currentRecord?.consultations || []),
          { id: consultation.id, diagnostic, prescription: prescription || '', notes: notes || '', status: 'VALIDATED', timestamp },
        ],
      }, 'VALIDATED', Number(req.userId));
    }
    publishRealtimeEvent({
      type: 'created', entity: 'consultation', entityId: consultation.id,
      patientIdentityUuid: patientIdentity?.identityUuid,
      audienceUserIds,
    });
    if (prescription) {
      publishRealtimeEvent({
        type: 'created', entity: 'prescription', entityId: `patient-${patientId}`,
        patientIdentityUuid: patientIdentity?.identityUuid,
        audienceUserIds,
      });
    }

    res.json({
      success: true,
      data: consultation,
      message: 'Consultation signée numériquement et épinglée sur IPFS',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// GET /api/doctors/patient/:patientId/dossier - Dossier médical du patient
router.get('/patient/:patientId/dossier', requireAuth, requireRole('doctor', 'admin'), async (req: any, res: Response) => {
  try {
    const { patientId } = req.params;
    const doctorId = String(req.userId);

    if (dbService.getStatus().connected && req.userRole !== 'admin') {
      const consent = await dbService.query(
        `SELECT 1 FROM patient_consents pc
         JOIN patients p ON p.id = pc.patient_id
         JOIN doctors d ON d.id = pc.doctor_id
         WHERE p.id = $1 AND d.user_id = $2 AND pc.status = 'active'
           AND pc.expires_at > CURRENT_TIMESTAMP
         LIMIT 1`,
        [patientId, req.userId]
      );
      if (!consent?.rows[0]) {
        return res.status(403).json({ success: false, error: 'Patient consent required' });
      }
    }

    if (dbService.getStatus().connected) {
      const patientResult = await dbService.query<any>(
        `SELECT p.id::text, p.first_name || ' ' || p.last_name AS name,
                EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth))::int AS age,
                COALESCE(p.blood_type, 'Non renseigné') AS blood,
                COALESCE(p.allergies, 'Aucune') AS allergies
         FROM patients p
         JOIN doctor_patients dp ON dp.patient_id = p.id
         WHERE (p.id::text = $1 OR p.npi = $1 OR p.user_id::text = $1)
           AND dp.doctor_user_id = $2 LIMIT 1`,
        [patientId, req.userId]
      );
      const patient = patientResult?.rows[0];
      if (!patient) return res.status(404).json({ success: false, error: 'Patient introuvable' });

      const [consultations, prescriptions] = await Promise.all([
        dbService.query<any>(`SELECT id, TO_CHAR(created_at, 'DD/MM/YYYY') AS date,
          TO_CHAR(created_at, 'HH24:MI') AS time, patient_name AS "patientName",
          diagnostic, prescription, notes, blockchain_hash AS "blockchainHash",
          ipfs_cid AS "ipfsCid" FROM doctor_consultations
          WHERE patient_id = $1 ORDER BY created_at DESC`, [patientId]),
        dbService.query<any>(`SELECT id, medication, dosage, frequency, status,
          patient_name AS "patientName", TO_CHAR(created_at, 'DD/MM/YYYY') AS date
          FROM doctor_prescriptions WHERE patient_id = $1
          ORDER BY created_at DESC`, [patientId]),
      ]);
      await dbService.query(
        `INSERT INTO doctor_audit_logs (id, doctor_user_id, action, patient_name, details, tx_hash)
         VALUES ($1, $2, 'Accès au dossier', $3, $4, $5)`,
        [`log-${Date.now()}`, req.userId, patient.name, `Consultation du dossier médical de ${patient.name}`, generateBlockchainHash(`access-${patientId}-${doctorId}`)]
      );
      const detailedRecord = await getMedicalRecord((await resolvePatientIdentity(patientId))?.identityUuid || '', false);
      return res.json({ success: true, data: {
        patientId: patient.id, patientName: patient.name, age: patient.age,
        blood: patient.blood, allergies: patient.allergies,
        consultations: consultations?.rows || [], prescriptions: prescriptions?.rows || [],
        vaccines: [], bloodDonations: [], documents: [], detailedRecord,
      } });
    }

    let patient = DOCTOR_PATIENTS_DB.find((p) => p.id === patientId);
    let raw: any = {};
    if (fs.existsSync(DB_FILE)) {
      raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      const authUser = (Array.isArray(raw.AUTH_USERS_DB) ? raw.AUTH_USERS_DB : [])
        .find((user: any) => user.role === 'patient' && String(user.id) === String(patientId));
      const profile = authUser ? (raw.PATIENTS_DB || {})[authUser.email] : undefined;
      if (authUser) {
        patient = {
          ...(patient || {}),
          id: String(authUser.id),
          email: authUser.email,
          name: profile?.name || patient?.name || authUser.email,
          age: profile?.dateOfBirth ? Math.max(0, new Date().getFullYear() - new Date(profile.dateOfBirth).getFullYear()) : patient?.age || 0,
          blood: profile?.bloodGroup || patient?.blood || 'Non renseigné',
          allergies: profile?.allergies || patient?.allergies || 'Aucune',
          npi: profile?.npi || `BJ${String(authUser.id).padStart(11, '0')}`,
        };
      }
    }
    if (!patient) {
      return res.status(404).json({ success: false, error: 'Patient introuvable' });
    }

    // Log d'audit pour accès au dossier
    const profile = DOCTOR_PROFILES_DB[doctorId] || DOCTOR_PROFILES_DB['2'];
    const accessLog = {
      id: `log-${Date.now()}`,
      doctorId,
      date: new Date().toLocaleDateString('fr-FR'),
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      action: 'Accès au dossier',
      patientName: patient.name,
      doctorName: profile?.name || 'Dr. Sossou',
      txHash: generateBlockchainHash(`access-${patientId}-${doctorId}`),
      status: 'confirmed',
      details: `Consultation du dossier médical de ${patient.name}`,
    };
    DOCTOR_AUDIT_LOGS_DB.unshift(accessLog);
    saveDocumentData();

    // Consultations du patient
    const patientConsultations = DOCTOR_CONSULTATIONS_DB.filter((c) => String(c.patientId) === String(patientId));
    const patientPrescriptions = DOCTOR_PRESCRIPTIONS_DB.filter((p) => String(p.patientId) === String(patientId));
    const patientAppointments = (raw.APPOINTMENTS_DB || []).filter((appointment: any) =>
      String(appointment.patientId || appointment.patient_id || '') === String(patientId) ||
      appointment.patientEmail === patient.email || appointment.patientPhone === patient.phone
    );
    const patientDocuments = (raw.MEDICAL_DOCUMENTS_DB || []).filter((document: any) =>
      String(document.patientId || document.patient_id || '') === String(patientId) ||
      document.patientEmail === patient.email || document.patientNpi === patient.npi
    );

    const dossier = {
      patientId,
      patientName: patient.name,
      age: patient.age,
      blood: patient.blood,
      allergies: patient.allergies || 'Aucune',
      consultations: patientConsultations.length > 0
        ? patientConsultations.map((c) => ({
            id: c.id,
            date: c.date,
            time: c.time,
            doctorName: c.doctorName,
            hospitalName: c.hospitalName,
            reason: c.notes || 'Consultation générale',
            diagnostic: c.diagnostic,
            prescription: c.prescription || '',
            attachments: [],
            blockchainHash: c.blockchainHash,
          }))
        : [],
      prescriptions: patientPrescriptions,
      vaccines: [],
      bloodDonations: [],
      documents: patientDocuments,
      appointments: patientAppointments,
      detailedRecord: await getMedicalRecord((await resolvePatientIdentity(patientId))?.identityUuid || '', false),
    };

    res.json({ success: true, data: dossier });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// GET /api/doctors/audit-logs - Logs d'audit (blockchain)
router.get('/audit-logs', requireAuth, requireRole('doctor', 'admin'), (req: any, res: Response) => {
  try {
    const doctorId = String(req.userId);

    if (dbService.getStatus().connected) {
      dbService.query<any>(
        `SELECT id, TO_CHAR(created_at, 'DD/MM/YYYY') AS date,
                TO_CHAR(created_at, 'HH24:MI') AS time, action,
                patient_name AS "patientName", details, tx_hash AS "txHash", status
         FROM doctor_audit_logs WHERE doctor_user_id = $1 ORDER BY created_at DESC`,
        [req.userId]
      ).then(result => res.json({ success: true, data: result?.rows || [], count: result?.rows.length || 0 }))
        .catch(error => res.status(500).json({ success: false, error: String(error) }));
      return;
    }

    const logs = DOCTOR_AUDIT_LOGS_DB.filter(
      (l) => l.doctorId === doctorId || l.doctorId === '2'
    );

    res.json({ success: true, data: logs, count: logs.length });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// GET /api/doctors/prescriptions - Prescriptions du médecin
router.get('/prescriptions', requireAuth, requireRole('doctor', 'admin'), (req: any, res: Response) => {
  try {
    const doctorId = String(req.userId);

    if (dbService.getStatus().connected) {
      dbService.query<any>(
        `SELECT id, medication, dosage, frequency, patient_name AS "patientName",
                patient_id::text AS "patientId", TO_CHAR(created_at, 'YYYY-MM-DD') AS date, status
         FROM doctor_prescriptions WHERE doctor_user_id = $1 ORDER BY created_at DESC`,
        [req.userId]
      ).then(result => res.json({ success: true, data: result?.rows || [] }))
        .catch(error => res.status(500).json({ success: false, error: String(error) }));
      return;
    }

    const prescriptions = DOCTOR_PRESCRIPTIONS_DB.filter(
      (p) => p.doctorId === doctorId || p.doctorId === '2'
    );

    res.json({ success: true, data: prescriptions });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// PATCH /api/doctors/prescriptions/:id - Mettre à jour le statut d'une prescription
router.patch('/prescriptions/:id', requireAuth, requireRole('doctor'), (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Statut invalide' });
    }
    if (dbService.getStatus().connected) {
      dbService.query<any>(
        `UPDATE doctor_prescriptions SET status = $1 WHERE id = $2 AND doctor_user_id = $3 RETURNING id, status`,
        [status, id, req.userId]
      ).then(result => {
        if (!result?.rows[0]) return res.status(404).json({ success: false, error: 'Prescription introuvable' });
        return res.json({ success: true, data: result.rows[0] });
      }).catch(error => res.status(500).json({ success: false, error: String(error) }));
      return;
    }

    const prescription = DOCTOR_PRESCRIPTIONS_DB.find((p) => p.id === id);
    if (!prescription) {
      return res.status(404).json({ success: false, error: 'Prescription introuvable' });
    }

    prescription.status = status;
    saveDocumentData();

    res.json({ success: true, data: prescription });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

export default router;
