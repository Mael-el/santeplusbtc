// ============================================================================
// ROUTES AUTH SERVICE
// ============================================================================

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { PoolClient } from 'pg';
import { authConfig } from '../services/config.service';
import { dbService } from '../services/db.service';
import { loginRateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

function asyncHandler(handler: (req: Request, res: Response) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

interface AuthUser {
  id: number;
  email: string | null;
  phone: string;
  role: string;
  password_hash: string;
}

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { canonicalPatientNpi, identityUuidForUser } from '../services/identity.service';

const DB_FILE = path.join(process.cwd(), 'data_db.json');

let users: AuthUser[] = [];
let nextUserId = 1;
const passwordResetRequests = new Map<string, { userId: number; code: string; expiresAt: number }>();

function saveAuthUsers(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JSON auth storage is disabled in production');
  }
  try {
    let existing: any = {};
    if (fs.existsSync(DB_FILE)) {
      existing = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
    fs.writeFileSync(DB_FILE, JSON.stringify({
      ...existing,
      AUTH_USERS_DB: users,
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save auth users:', err);
  }
}

function loadAuthUsers(): void {
  if (process.env.NODE_ENV === 'production') {
    users = [];
    return;
  }
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (Array.isArray(raw.AUTH_USERS_DB) && raw.AUTH_USERS_DB.length > 0) {
        users = raw.AUTH_USERS_DB;
        nextUserId = Math.max(...users.map(u => u.id), 0) + 1;
        return;
      }
    }
  } catch (e) {
    // fallback
  }

  // Keep the development store empty until an account is explicitly created.
  users = [];
  nextUserId = 1;
}

loadAuthUsers();

async function findUser(criteria: { id?: number; email?: string; phone?: string }): Promise<AuthUser | undefined> {
  if (dbService.getStatus().connected) {
    const conditions: string[] = [];
    const params: string[] = [];

    if (criteria.id !== undefined) {
      conditions.push(`id = $${params.length + 1}`);
      params.push(String(criteria.id));
    }
    if (criteria.email !== undefined) {
      conditions.push(`LOWER(email) = LOWER($${params.length + 1})`);
      params.push(criteria.email);
    }
    if (criteria.phone) {
      conditions.push(`phone = $${params.length + 1}`);
      params.push(criteria.phone);
    }

    if (conditions.length > 0) {
      const result = await dbService.query<AuthUser>(
        `SELECT id, email, phone, role, password_hash FROM users
         WHERE role = 'patient' AND (${conditions.join(' OR ')}) LIMIT 1`,
        params
      );
      return result?.rows[0];
    }
  }

  loadAuthUsers();
  return users.find(user => user.role === 'patient' && (
    (criteria.id !== undefined && user.id === criteria.id) ||
    (criteria.email !== undefined && user.email?.toLowerCase() === criteria.email.toLowerCase()) ||
    (criteria.phone !== undefined && user.phone === criteria.phone)
  ));
}

type ProfileData = {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  specialty?: string;
  bloodType?: string;
  allergies?: string;
  emergencyContacts?: Array<{ name: string; phone: string }>;
};

async function insertRoleProfile(client: PoolClient, user: AuthUser, data: ProfileData): Promise<void> {
  const firstName = data.firstName || 'Utilisateur';
  const lastName = data.lastName || 'Patient';
  const npi = `BJ${String(user.id).padStart(11, '0')}`;
  const identityUuid = crypto.randomUUID();
  const qrCodeHash = crypto.createHash('sha256').update(`${user.id}:${user.phone}`).digest('hex');

  await client.query(
    `INSERT INTO identity_registry
       (identity_uuid, user_id, role, email, phone, npi, qr_code_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, phone = EXCLUDED.phone,
       npi = EXCLUDED.npi, qr_code_hash = EXCLUDED.qr_code_hash`,
    [identityUuid, user.id, user.role, user.email, user.phone,
      user.role === 'patient' ? canonicalPatientNpi(user.id) : npi, qrCodeHash]
  );

  if (user.role === 'patient') {
    await client.query(
      `INSERT INTO patients
      (user_id, identity_uuid, first_name, last_name, date_of_birth, gender, npi, qr_code_hash, pin_hash, blood_type, allergies, emergency_contacts)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        user.id,
        identityUuid,
        firstName,
        lastName,
        data.dateOfBirth || '1970-01-01',
        data.gender || 'non_specifie',
        canonicalPatientNpi(user.id),
        qrCodeHash,
        hashPassword(`${user.id}${user.phone.slice(-4)}`),
        data.bloodType || null,
        data.allergies || null,
        JSON.stringify(data.emergencyContacts || []),
      ]
    );
    await client.query(
      `INSERT INTO wallet_accounts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );
  }

  if (user.role === 'doctor') {
    await client.query(
      `INSERT INTO doctors
       (user_id, first_name, last_name, specialty, license_number, npi)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        user.id,
        firstName,
        lastName,
        data.specialty || 'Médecine générale',
        `BJ-MED-${user.id}`,
        npi,
      ]
    );
  }
}

async function createUserWithProfile(user: Omit<AuthUser, 'id'>, data: ProfileData): Promise<AuthUser> {
  if (dbService.getStatus().connected) {
    const createdUser = await dbService.transaction(async client => {
      const result = await client.query<AuthUser>(
        `INSERT INTO users (email, phone, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, phone, role, password_hash`,
        [user.email, user.phone, user.password_hash, user.role]
      );
      const persistedUser = result.rows[0];
      await insertRoleProfile(client, persistedUser, data);
      return persistedUser;
    });
    if (createdUser) {
      return createdUser;
    }
  }

  const createdUser = { ...user, id: nextUserId++ };
  users.push(createdUser);
  if (createdUser.role === 'patient') {
    let existing: any = {};
    try {
      if (fs.existsSync(DB_FILE)) {
        existing = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      }
    } catch (error) {
      existing = {};
    }
    const profiles = existing.PATIENTS_DB && typeof existing.PATIENTS_DB === 'object'
      ? existing.PATIENTS_DB
      : {};
    const profileKey = createdUser.email || createdUser.phone;
    profiles[profileKey] = {
      ...profiles[profileKey],
      name: `${data.firstName || 'Utilisateur'} ${data.lastName || ''}`.trim(),
      email: createdUser.email,
      phone: createdUser.phone,
      npi: canonicalPatientNpi(createdUser.id),
      bloodGroup: data.bloodType || '',
      allergies: data.allergies || 'Aucune',
      dateOfBirth: data.dateOfBirth || null,
      gender: data.gender || 'non_specifie',
      emergencyContacts: data.emergencyContacts || [],
      identityUuid: identityUuidForUser(createdUser.id, createdUser.phone),
      qrCodeHash: crypto.createHash('sha256').update(`${createdUser.id}:${createdUser.phone}`).digest('hex'),
    };
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify({ ...existing, PATIENTS_DB: profiles }, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save patient profile:', error);
    }
  }
  saveAuthUsers();
  return createdUser;
}

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password: string, hash: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(hash) && bcrypt.compareSync(password, hash);
}

function validateCredentials(email: unknown, phone: unknown, password: unknown): string | null {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return 'Le mot de passe doit contenir entre 8 et 128 caractères';
  }
  if (email !== undefined && (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email))) {
    return 'Adresse email invalide';
  }
  if (phone !== undefined && (typeof phone !== 'string' || phone.trim().length < 8 || phone.length > 30)) {
    return 'Numéro de téléphone invalide';
  }
  return null;
}

function generateTokens(user: AuthUser) {
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    authConfig.accessSecret,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    authConfig.refreshSecret,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  const secure = process.env.NODE_ENV === 'production';
  const flags = `HttpOnly; Path=/; SameSite=Strict${secure ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', [
    `sante_access_token=${encodeURIComponent(accessToken)}; Max-Age=900; ${flags}`,
    `sante_refresh_token=${encodeURIComponent(refreshToken)}; Max-Age=604800; ${flags}`,
  ]);
}

// POST /api/auth/register/patient
router.post('/register/patient', asyncHandler(async (req: Request, res: Response) => {
  const { email, phone, password, firstName, lastName, dateOfBirth, gender, bloodType, allergies, emergencyContacts } = req.body;

  if (!email || !phone || !password || !firstName || !lastName || !dateOfBirth || !gender) {
    return res.status(400).json({ success: false, error: 'Les informations personnelles obligatoires sont manquantes' });
  }
  const validationError = validateCredentials(email, phone, password);
  if (validationError) return res.status(400).json({ success: false, error: validationError });

  if (await findUser({ email, phone })) {
    return res.status(409).json({ success: false, error: 'Email ou téléphone déjà enregistré' });
  }

  const newUser = await createUserWithProfile({
    email,
    phone,
    role: 'patient',
    password_hash: hashPassword(password),
  }, { firstName, lastName, dateOfBirth, gender, bloodType, allergies, emergencyContacts });

  let patientNpi: string | undefined;
  if (dbService.getStatus().connected) {
    const profile = await dbService.query<{ npi: string }>(
      'SELECT npi FROM patients WHERE user_id = $1 LIMIT 1',
      [newUser.id]
    );
    patientNpi = profile?.rows[0]?.npi;
  }

  const { accessToken, refreshToken } = generateTokens(newUser);
  setAuthCookies(res, accessToken, refreshToken);

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: {
        id: newUser.id,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        npi: patientNpi,
        qrCodeHash: crypto.createHash('sha256').update(`${newUser.id}:${newUser.phone}`).digest('hex'),
        bloodGroup: bloodType || '',
        allergies: allergies || 'Aucune',
      },
      expiresIn: 900,
    },
  });
}));

// POST /api/auth/register/doctor
router.post('/register/doctor', asyncHandler(async (req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    error: 'Utilisez le registre professionnel pour créer un compte médecin',
  });

  const { email, phone, password, firstName, lastName, specialty } = req.body;

  if (!email || !phone || !password) {
    return res.status(400).json({ success: false, error: 'Champs obligatoires manquants' });
  }
  const validationError = validateCredentials(email, phone, password);
  if (validationError) return res.status(400).json({ success: false, error: validationError });

  if (await findUser({ email, phone })) {
    return res.status(409).json({ success: false, error: 'Email ou téléphone déjà enregistré' });
  }

  const newUser = await createUserWithProfile({
    email,
    phone,
    role: 'doctor',
    password_hash: hashPassword(password),
  }, { firstName, lastName, specialty });

  const { accessToken, refreshToken } = generateTokens(newUser);

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: { id: newUser.id, email: newUser.email, phone: newUser.phone, role: newUser.role },
      expiresIn: 900,
    },
  });
}));

// POST /api/auth/register/hospital
router.post('/register/hospital', asyncHandler(async (req: Request, res: Response) => {
  return res.status(410).json({
    success: false,
    error: 'Utilisez le registre des établissements pour créer un compte administrateur',
  });

  const { email, phone, password, firstName, lastName, hospitalName } = req.body;

  if (!email || !phone || !password) {
    return res.status(400).json({ success: false, error: 'Champs obligatoires manquants' });
  }
  const validationError = validateCredentials(email, phone, password);
  if (validationError) return res.status(400).json({ success: false, error: validationError });

  if (await findUser({ email, phone })) {
    return res.status(409).json({ success: false, error: 'Email ou téléphone déjà enregistré' });
  }

  const newUser = await createUserWithProfile({
    email,
    phone,
    role: 'admin',
    password_hash: hashPassword(password),
  }, { firstName, lastName, specialty: hospitalName });

  const { accessToken, refreshToken } = generateTokens(newUser);

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: { id: newUser.id, email: newUser.email, phone: newUser.phone, role: newUser.role },
      expiresIn: 900,
    },
  });
}));

// POST /api/auth/password-reset/request
router.post('/password-reset/request', asyncHandler(async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Adresse email invalide' });
  }

  const user = await findUser({ email });
  const response: { success: true; message: string; devCode?: string } = {
    success: true,
    message: 'Si cette adresse correspond à un patient, un code de réinitialisation a été envoyé.',
  };

  if (user) {
    const code = String(crypto.randomInt(100000, 1000000));
    passwordResetRequests.set(email, { userId: user.id, code, expiresAt: Date.now() + 15 * 60 * 1000 });
    // The production email provider can consume this event. Keep the code visible only in local development.
    if (process.env.NODE_ENV !== 'production') response.devCode = code;
    console.info(`[Auth] Password reset requested for ${email}`);
  }

  return res.json(response);
}));

// POST /api/auth/password-reset/confirm
router.post('/password-reset/confirm', asyncHandler(async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const request = passwordResetRequests.get(email);

  if (!request || request.expiresAt < Date.now() || request.code !== code) {
    return res.status(400).json({ success: false, error: 'Code invalide ou expiré' });
  }
  const validationError = validateCredentials(email, undefined, newPassword);
  if (validationError) return res.status(400).json({ success: false, error: validationError });

  if (dbService.getStatus().connected) {
    await dbService.query('UPDATE users SET password_hash = $1 WHERE id = $2 AND role = \'patient\'', [hashPassword(newPassword), request.userId]);
  } else {
    loadAuthUsers();
    const user = users.find(item => item.id === request.userId && item.role === 'patient');
    if (user) {
      user.password_hash = hashPassword(newPassword);
      saveAuthUsers();
    }
  }
  passwordResetRequests.delete(email);
  return res.json({ success: true, message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' });
}));

// POST /api/auth/login
router.post('/login', loginRateLimit, asyncHandler(async (req: Request, res: Response) => {
  const { phone, email, password } = req.body;

  if ((!phone && !email) || !password) {
    return res.status(400).json({ success: false, error: 'Missing phone or email, or password' });
  }
  const validationError = validateCredentials(email, phone, password);
  if (validationError) return res.status(400).json({ success: false, error: validationError });

  const user = await findUser({ email, phone });

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
  }

  const { accessToken, refreshToken } = generateTokens(user);
  setAuthCookies(res, accessToken, refreshToken);

  let extraProfile: any = {};
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (raw.PATIENTS_DB) {
        extraProfile = raw.PATIENTS_DB[user.email] || raw.PATIENTS_DB[user.phone] || {};
      }
    }
  } catch (e) {}

  if (dbService.getStatus().connected && user.role === 'patient') {
    const profile = await dbService.query<any>(
      `SELECT p.npi, p.qr_code_hash AS "qrCodeHash", p.blood_type AS "bloodGroup", p.first_name AS "firstName", p.last_name AS "lastName"
       FROM patients p WHERE p.user_id = $1 LIMIT 1`,
      [user.id]
    );
    extraProfile = { ...extraProfile, ...(profile?.rows[0] || {}) };
  }
  if (user.role === 'patient' && !extraProfile.npi) {
    extraProfile.npi = `BJ${String(user.id).padStart(11, '0')}`;
  }
  const profileName = extraProfile.name
    || `${extraProfile.firstName || ''} ${extraProfile.lastName || ''}`.trim()
    || 'Patient';

  res.json({
    success: true,
    data: {
      accessToken,
      refreshToken,
      user: { 
        id: user.id, 
        email: user.email, 
        phone: user.phone, 
        role: user.role,
        name: profileName,
        firstName: extraProfile.firstName,
        lastName: extraProfile.lastName,
        walletBalance: extraProfile.walletBalance,
        satoshiBalance: extraProfile.satoshiBalance,
        npi: extraProfile.npi,
        qrCodeHash: extraProfile.qrCodeHash,
        bloodGroup: extraProfile.bloodGroup,
      },
      expiresIn: 900,
    },
  });
}));

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ success: false, error: 'Missing refresh token' });
  }

  try {
    const decoded: any = jwt.verify(refreshToken, authConfig.refreshSecret);
    const user = await findUser({ id: decoded.id });

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const tokens = generateTokens(user);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: { id: user.id, email: user.email, phone: user.phone, role: user.role },
        expiresIn: 900,
      },
    });
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
});

// GET /api/auth/me
router.get('/me', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  try {
    const decoded: any = jwt.verify(token, authConfig.accessSecret);
    const user = await findUser({ id: decoded.id });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      data: { id: user.id, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.setHeader('Set-Cookie', [
    'sante_access_token=; Max-Age=0; HttpOnly; Path=/; SameSite=Strict',
    'sante_refresh_token=; Max-Age=0; HttpOnly; Path=/; SameSite=Strict',
  ]);
  res.json({ success: true, data: { message: 'Logout successful' } });
});

// POST /api/auth/2fa/verify
router.post('/2fa/verify', (req: Request, res: Response) => {
  return res.status(501).json({
    success: false,
    error: 'La double authentification n’est pas encore configurée pour ce compte',
  });
});

export default router;
