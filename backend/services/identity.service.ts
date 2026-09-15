import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { dbService } from './db.service';

export interface PatientIdentity {
  identityUuid: string;
  userId: number;
  patientId: string;
  email: string;
  phone: string;
  npi: string;
  qrCodeHash?: string;
}

const DB_FILE = path.join(process.cwd(), 'data_db.json');

function normalize(value: unknown): string {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function stableUuid(seed: string): string {
  const hex = crypto.createHash('sha256').update(seed).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export function canonicalPatientNpi(userId: number): string {
  return `BJ${String(userId).padStart(11, '0')}`;
}

export function identityUuidForUser(userId: number, email: string): string {
  return stableUuid(`santeplus:patient:${userId}:${email.toLowerCase()}`);
}

export async function resolvePatientIdentity(identifier: string): Promise<PatientIdentity | undefined> {
  const normalizedIdentifier = normalize(identifier);
  if (!normalizedIdentifier) return undefined;

  if (dbService.getStatus().connected) {
    const result = await dbService.query<PatientIdentity>(
      `SELECT ir.identity_uuid AS "identityUuid", ir.user_id AS "userId",
              p.id::text AS "patientId", ir.email, ir.phone, ir.npi,
              ir.qr_code_hash AS "qrCodeHash"
       FROM identity_registry ir
       JOIN patients p ON p.identity_uuid = ir.identity_uuid
       WHERE ir.role = 'patient'
         AND (LOWER(ir.email) = LOWER($1)
           OR regexp_replace(ir.phone, '[^0-9]', '', 'g') = regexp_replace($1, '[^0-9]', '', 'g')
           OR regexp_replace(LOWER(ir.npi), '[^a-z0-9]', '', 'g') = regexp_replace(LOWER($1), '[^a-z0-9]', '', 'g')
           OR ir.qr_code_hash = $1
           OR p.id::text = $1
           OR ir.user_id::text = $1)
       LIMIT 1`,
      [identifier]
    );
    if (result?.rows[0]) return result.rows[0];

    // Older patient records may not have been copied to identity_registry yet.
    const fallback = await dbService.query<PatientIdentity>(
      `SELECT COALESCE(ir.identity_uuid, '') AS "identityUuid", u.id AS "userId",
              p.id::text AS "patientId", u.email, u.phone,
              COALESCE(p.npi, 'BJ' || LPAD(u.id::text, 11, '0')) AS npi,
              p.qr_code_hash AS "qrCodeHash"
       FROM users u
       JOIN patients p ON p.user_id = u.id
       LEFT JOIN identity_registry ir ON ir.user_id = u.id
       WHERE u.role = 'patient'
         AND (LOWER(COALESCE(u.email, '')) = LOWER($1)
           OR regexp_replace(COALESCE(u.phone, ''), '[^0-9]', '', 'g') = regexp_replace($1, '[^0-9]', '', 'g')
           OR regexp_replace(LOWER(COALESCE(p.npi, '')), '[^a-z0-9]', '', 'g') = regexp_replace(LOWER($1), '[^a-z0-9]', '', 'g')
           OR p.id::text = $1
           OR u.id::text = $1)
       LIMIT 1`,
      [identifier.trim()]
    );
    const fallbackIdentity = fallback?.rows[0];
    if (fallbackIdentity && !fallbackIdentity.identityUuid) {
      fallbackIdentity.identityUuid = identityUuidForUser(
        Number(fallbackIdentity.userId),
        fallbackIdentity.email || fallbackIdentity.phone
      );
    }
    return fallbackIdentity;
  }

  if (!fs.existsSync(DB_FILE)) return undefined;
  const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const users = Array.isArray(raw.AUTH_USERS_DB) ? raw.AUTH_USERS_DB : [];
  const profiles = raw.PATIENTS_DB && typeof raw.PATIENTS_DB === 'object' ? raw.PATIENTS_DB : {};

  // 1. Chercher dans AUTH_USERS_DB
  const user = users.find((candidate: any) => {
    if (candidate.role !== 'patient') return false;
    const profile = profiles[candidate.email] || {};
    const npi = profile.npi || canonicalPatientNpi(Number(candidate.id));
    return normalize(candidate.email) === normalizedIdentifier ||
      normalize(candidate.phone) === normalizedIdentifier ||
      normalize(npi) === normalizedIdentifier ||
      normalize(candidate.id) === normalizedIdentifier;
  });
  if (user) {
    const profile = profiles[user.email] || {};
    return {
      identityUuid: profile.identityUuid || identityUuidForUser(Number(user.id), user.email),
      userId: Number(user.id),
      patientId: String(user.id),
      email: user.email,
      phone: user.phone,
      npi: profile.npi || canonicalPatientNpi(Number(user.id)),
      qrCodeHash: profile.qrCodeHash,
    };
  }

  // 2. Chercher dans PATIENTS_DB directement
  for (const [key, prof] of Object.entries(profiles) as [string, any][]) {
    const npi = prof?.npi || '';
    const phone = prof?.phone || '';
    const email = prof?.email || key;
    const name = prof?.name || '';
    if (
      normalize(email) === normalizedIdentifier ||
      normalize(phone) === normalizedIdentifier ||
      normalize(npi) === normalizedIdentifier ||
      normalize(name).includes(normalizedIdentifier) ||
      normalize(prof?.identityUuid) === normalizedIdentifier
    ) {
      return {
        identityUuid: prof.identityUuid || stableUuid(`santeplus:patient:${email}`),
        userId: 100,
        patientId: prof.npi || String(key),
        email: email,
        phone: phone,
        npi: npi || 'BJ-CITOYEN',
        qrCodeHash: prof.qrCodeHash,
      };
    }
  }

  // 3. Chercher dans DOCTOR_PATIENTS_DB
  const doctorPatients = Array.isArray(raw.DOCTOR_PATIENTS_DB) ? raw.DOCTOR_PATIENTS_DB : [];
  const docPatient = doctorPatients.find((p: any) =>
    normalize(p.npi) === normalizedIdentifier ||
    normalize(p.name).includes(normalizedIdentifier) ||
    normalize(p.id) === normalizedIdentifier
  );
  if (docPatient) {
    return {
      identityUuid: stableUuid(`santeplus:patient:${docPatient.id}:${docPatient.name}`),
      userId: Number(docPatient.id) || 101,
      patientId: String(docPatient.id),
      email: `${normalize(docPatient.name)}@patient.santeplus.bj`,
      phone: '+229 01 97 00 00 01',
      npi: docPatient.npi || `BJ${String(docPatient.id).padStart(11, '0')}`,
    };
  }

  return undefined;
}
