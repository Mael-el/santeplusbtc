import express from "express";
import { createServer as createHttpServer } from "node:http";
import path from "path";
import net from "node:net";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import crypto from "crypto";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import authRoutes from "./backend/routes/auth.routes";
import patientRoutes from "./backend/routes/patient.routes";
import hospitalAdminRoutes from "./backend/routes/hospital.routes";
import paymentRoutes from "./backend/routes/payment.routes";
import paymentV3Routes from "./backend/routes/payment.v3.routes";
import { paymentService } from "./backend/services/payment.service";
import doctorRoutes from "./backend/routes/doctor.routes";
import bloodRoutes from "./backend/routes/blood.routes";
import notificationRoutes from "./backend/routes/notification.routes";
import auditRoutes from "./backend/routes/audit.routes";
import blockchainRoutes from "./backend/routes/blockchain.routes";
import aiRoutes from "./backend/routes/ai.routes";
import ipfsRoutes from "./backend/routes/ipfs.routes";
import { lightningService } from "./backend/services/lightning.service";
import { ipfsService } from "./backend/services/ipfs.service";
import { dbService } from "./backend/services/db.service";
import { momoService } from "./backend/services/momo.service";
import { requireAuth, requireRole } from "./backend/middleware/auth.middleware";
import { loginRateLimit } from "./backend/middleware/rate-limit.middleware";
import { authConfig } from "./backend/services/config.service";
import { publishRealtimeEvent, subscribeRealtime } from "./backend/services/realtime.service";
import { getPlatformMetrics, recordPlatformSession } from "./backend/services/platform-metrics.service";
import { WebSocketServer, WebSocket } from "ws";
import helmet from "helmet";

// Seed Databases in-memory
const XOF_TO_SATS = 1.666;

// Helper: SHA-256 hash
function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function setProfessionalAuthCookie(res: express.Response, token: string): void {
  const secure = process.env.NODE_ENV === 'production';
  res.setHeader('Set-Cookie', `sante_access_token=${encodeURIComponent(token)}; Max-Age=86400; HttpOnly; Path=/; SameSite=Strict${secure ? '; Secure' : ''}`);
}

// Bitcoin Blockchain Anchor Tracker (in-memory; can be moved to DB)
// For future integration with actual Bitcoin testnet/mainnet
let BLOCKCHAIN_ANCHORS: Record<string, {
  hash: string;
  txid?: string;
  bitcoinAddress?: string;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed';
  documentId: string;
}> = {};

let HOSPITALS_DB = [
  {
    id: "hz-calavi",
    name: "Hôpital de Zone d'Abomey-Calavi & Sô-Ava",
    type: "public",
    image: "https://images.unsplash.com/photo-1587351021355-a479a299d2f9?auto=format&fit=crop&q=80&w=600",
    rating: 4.3,
    reviewsCount: 142,
    distance: "1.2 km",
    address: "Rue de l'Hôpital de Zone, Quartier Sèmè-Podji, Abomey-Calavi",
    phone: "+229 01 21 36 01 22",
    hours: "Ouvert 24h/24",
    isVerified: true,
    services: ["Urgences", "Pédiatrie", "Maternité", "Chirurgie", "Médecine Générale"],
    priceList: [
      { name: "Consultation Médecine Générale", priceXOF: 2000, priceSats: 3330 },
      { name: "Bilan NFS / Sanguin Complet", priceXOF: 4500, priceSats: 7500 },
      { name: "Test Rapide Paludisme (GE)", priceXOF: 1500, priceSats: 2500 },
      { name: "Échographie Obstétricale", priceXOF: 8000, priceSats: 13320 },
      { name: "Ordonnance Traitement Paludisme type", priceXOF: 3500, priceSats: 5830 }
    ],
    reviews: [
      { id: "r1", author: "Pascal Houessou", rating: 5, date: "25 Juin 2026", comment: "Le service de pédiatrie est exceptionnel. Prise en charge très rapide pour mon fils." },
      { id: "r2", author: "Marielle Tossou", rating: 4, date: "12 Juin 2026", comment: "L'hôpital public de référence à Calavi. Parfois un peu d'attente aux urgences, mais les médecins sont très compétents." },
      { id: "r3", author: "Gaston Houndéton", rating: 4, date: "03 Juin 2026", comment: "Propre et bien organisé depuis la mise en place du paiement numérique. Pas de files d'attente interminables." }
    ],
    coords: { x: 48.0, y: 52.0 },
    lat: 6.4385,
    lng: 2.3412
  },
  {
    id: "chd-atlantique",
    name: "CHD Atlantique (Hôpital Universitaire)",
    type: "public",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=600",
    rating: 4.5,
    reviewsCount: 238,
    distance: "2.4 km",
    address: "Route Inter-États, Près du Campus Universitaire d'Abomey-Calavi (UAC)",
    phone: "+229 01 21 36 12 44",
    hours: "Ouvert 24h/24",
    isVerified: true,
    services: ["Urgences", "Cardiologie", "Radiologie", "Gynécologie", "Laboratoire d'analyses"],
    priceList: [
      { name: "Consultation Spécialiste", priceXOF: 5000, priceSats: 8330 },
      { name: "Radiographie Thoracique", priceXOF: 10000, priceSats: 16660 },
      { name: "Bilan Lipidique & Glycémie", priceXOF: 6000, priceSats: 10000 },
      { name: "Scanner Cérébral", priceXOF: 45000, priceSats: 75000 }
    ],
    reviews: [
      { id: "r4", author: "Chantal Agon", rating: 5, date: "18 Juin 2026", comment: "Équipements de pointe et professeurs très à l'écoute. Très bon suivi gynécologique." },
      { id: "r5", author: "Christian Soglo", rating: 4, date: "10 Juin 2026", comment: "Situé juste à côté de l'UAC. Pratique pour les étudiants et les habitants de Calavi." }
    ],
    coords: { x: 32.0, y: 38.0 },
    lat: 6.4182,
    lng: 2.3395
  },
  {
    id: "clinique-sainte-famille",
    name: "Clinique Privée Sainte-Famille",
    type: "private",
    image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&q=80&w=600",
    rating: 4.7,
    reviewsCount: 85,
    distance: "3.8 km",
    address: "Quartier Zogbadjè, Face 2ème entrée du Campus, Abomey-Calavi",
    phone: "+229 01 97 45 11 89",
    hours: "07:00 - 22:00",
    isVerified: true,
    services: ["Médecine Générale", "Maternité", "Pédiatrie", "Dentisterie", "Échographie"],
    priceList: [
      { name: "Consultation Générale", priceXOF: 3000, priceSats: 5000 },
      { name: "Consultation Dentaire", priceXOF: 5000, priceSats: 8330 },
      { name: "Détartrage & Soins", priceXOF: 15000, priceSats: 25000 },
      { name: "Échographie Pelvienne", priceXOF: 10000, priceSats: 16660 }
    ],
    reviews: [
      { id: "r6", author: "Patient vérifié", rating: 5, date: "29 Juin 2026", comment: "Service réactif et prise en charge satisfaisante." },
      { id: "r7", author: "Félicité Kpodékon", rating: 4, date: "21 Juin 2026", comment: "Clinique privée excellente. Les tarifs sont un peu plus élevés mais le confort et l'accueil le justifient largement." }
    ],
    coords: { x: 58.0, y: 28.0 },
    lat: 6.4255,
    lng: 2.3298
  },
  {
    id: "cs-calavi-centre",
    name: "Centre de Santé de Calavi-Centre",
    type: "clinic",
    image: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=600",
    rating: 3.9,
    reviewsCount: 56,
    distance: "0.8 km",
    address: "Avenue de la Mairie, En face de l'Hôtel de Ville, Abomey-Calavi",
    phone: "+229 01 21 36 04 11",
    hours: "08:00 - 18:00",
    isVerified: false,
    services: ["Vaccination", "Planification Familiale", "Consultation Prénatale", "Soins Infirmiers"],
    priceList: [
      { name: "Consultation Infirmière", priceXOF: 1000, priceSats: 1660 },
      { name: "Pansement & Injection", priceXOF: 800, priceSats: 1330 },
      { name: "Carnet de Santé & Pesée", priceXOF: 500, priceSats: 830 }
    ],
    reviews: [
      { id: "r8", author: "Ablavi Hounkpè", rating: 4, date: "14 Juin 2026", comment: "Centre public idéal pour les vaccins et suivis de bébé. Très abordable." }
    ],
    coords: { x: 44.0, y: 68.0 },
    lat: 6.4452,
    lng: 2.3478
  },
  {
    id: "clinique-solidarite",
    name: "Clinique de la Solidarité (Bidossessi)",
    type: "private",
    image: "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=600",
    rating: 4.2,
    reviewsCount: 42,
    distance: "1.9 km",
    address: "Bidossessi, à 200m du Carrefour Kpota, Abomey-Calavi",
    phone: "+229 01 95 33 22 11",
    hours: "08:00 - 20:00",
    isVerified: true,
    services: ["Médecine Générale", "Petite Chirurgie", "Analyses Médicales", "Pharmacie de garde"],
    priceList: [
      { name: "Consultation de Jour", priceXOF: 2500, priceSats: 4160 },
      { name: "Consultation d'Urgence / Nuit", priceXOF: 5000, priceSats: 8330 },
      { name: "Analyse d'Urine (ECBU)", "priceXOF": 4000, "priceSats": 6660 },
      { name: "Suture de Plaie Simple", "priceXOF": 6000, "priceSats": 10000 }
    ],
    reviews: [
      { id: "r9", author: "Marc Djivo", rating: 4, date: "26 Mai 2026", comment: "Clinique de quartier sérieuse. Prise en charge immédiate pour les petites urgences." }
    ],
    coords: { x: 74.0, y: 48.0 },
    lat: 6.4520,
    lng: 2.3595
  }
];

let APPOINTMENTS_DB: any[] = [];
let MEDICAL_DOCUMENTS_DB: any[] = [];
let INVOICES_DB: any[] = [];

let LIGHTNING_INVOICES_DB: Record<string, {
  id: string;
  amountXOF: number;
  amountSats: number;
  bolt11: string;
  paymentHash?: string;
  isPaid: boolean;
  txHash: string;
  provider?: string;
  isLive?: boolean;
  createdAt: number;
}> = {};

let ACCESS_REQUESTS_DB: any[] = [];

let PATIENTS_DB: Record<string, any> = {};

let HOSPITAL_USERS_DB: any[] = [];

function isBcryptHash(value: unknown): value is string {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

function nextHospitalUserId(): number {
  return Math.max(0, ...HOSPITAL_USERS_DB.map(user => Number(user.id) || 0)) + 1;
}

const DB_FILE = path.join(process.cwd(), "data_db.json");

async function ownsPatientEmail(userId: number, email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  if (dbService.getStatus().connected) {
    const result = await dbService.query(
      `SELECT 1 FROM users WHERE id = $1 AND role = 'patient' AND LOWER(email) = LOWER($2) LIMIT 1`,
      [userId, normalizedEmail]
    );
    return Boolean(result?.rows[0]);
  }
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return (raw.AUTH_USERS_DB || []).some((user: any) =>
      Number(user.id) === Number(userId) && user.role === 'patient' && user.email?.toLowerCase() === normalizedEmail
    );
  } catch {
    return false;
  }
}

function ownsPatientEmailInFallback(userId: number, email: string): boolean {
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const normalizedEmail = email.toLowerCase().trim();
    return (raw.AUTH_USERS_DB || []).some((user: any) =>
      Number(user.id) === Number(userId) && user.role === 'patient' && user.email?.toLowerCase() === normalizedEmail
    );
  } catch {
    return false;
  }
}

function saveDb() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('data_db.json is disabled in production');
  }
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify({
      HOSPITALS_DB,
      APPOINTMENTS_DB,
      MEDICAL_DOCUMENTS_DB,
      INVOICES_DB,
      LIGHTNING_INVOICES_DB,
      ACCESS_REQUESTS_DB,
      PATIENTS_DB,
      HOSPITAL_USERS_DB
    }, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save database:", err);
  }
}

function loadDb() {
  if (process.env.NODE_ENV === 'production') return;
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf8");
      const data = JSON.parse(raw);
      if (data.HOSPITALS_DB) HOSPITALS_DB = data.HOSPITALS_DB;
      if (data.APPOINTMENTS_DB) APPOINTMENTS_DB = data.APPOINTMENTS_DB;
      if (data.MEDICAL_DOCUMENTS_DB) MEDICAL_DOCUMENTS_DB = data.MEDICAL_DOCUMENTS_DB;
      if (data.INVOICES_DB) INVOICES_DB = data.INVOICES_DB;
      if (data.LIGHTNING_INVOICES_DB) LIGHTNING_INVOICES_DB = data.LIGHTNING_INVOICES_DB;
      if (data.ACCESS_REQUESTS_DB) ACCESS_REQUESTS_DB = data.ACCESS_REQUESTS_DB;
      if (data.PATIENTS_DB) PATIENTS_DB = data.PATIENTS_DB;
      if (Array.isArray(data.HOSPITAL_USERS_DB) && data.HOSPITAL_USERS_DB.length > 0) {
        HOSPITAL_USERS_DB = data.HOSPITAL_USERS_DB;
        let migratedPasswords = false;
        for (const user of HOSPITAL_USERS_DB) {
          if (!user.id) {
            user.id = user.email === 'admin@santeplus.bj'
              ? 1
              : user.email === 'direction@hz-calavi.bj'
                ? 2
                : user.email === 'dr.sossou@hz-calavi.bj'
                  ? 3
                  : nextHospitalUserId();
            migratedPasswords = true;
          }
          if (!isBcryptHash(user.password)) {
            user.password = bcrypt.hashSync(user.password, 10);
            migratedPasswords = true;
          }
        }
        if (migratedPasswords) saveDb();
      } else {
        const adminPass = process.env.INITIAL_ADMIN_PASSWORD;
        const directorPass = process.env.INITIAL_DIRECTOR_PASSWORD;
        const doctorPass = process.env.INITIAL_DOCTOR_PASSWORD;
        if (!adminPass || !directorPass || !doctorPass) {
          throw new Error('Initial hospital passwords must be configured');
        }
        HOSPITAL_USERS_DB = [
          {
            email: "admin@santeplus.bj",
            password: bcrypt.hashSync(adminPass, 10),
            hospitalId: "system-admin",
            role: "superadmin",
            name: "Super Administrateur Santé+"
          },
          {
            email: "direction@hz-calavi.bj",
            password: bcrypt.hashSync(directorPass, 10),
            hospitalId: "hz-calavi",
            role: "admin",
            name: "Directeur HZ Calavi & Sô-Ava"
          },
          {
            email: "dr.sossou@hz-calavi.bj",
            password: bcrypt.hashSync(doctorPass, 10),
            hospitalId: "hz-calavi",
            role: "doctor",
            name: "Dr. Jean Sossou"
          }
        ];
        saveDb();
      }
      console.log("Database successfully loaded from", DB_FILE);
    } else {
      saveDb();
    }
  } catch (err) {
    console.error("Failed to load database:", err);
  }
}

function hasValidWebhookSignature(payload: unknown, rawBody: Buffer | undefined, signature: unknown, secret: string | undefined): boolean {
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  if (typeof signature !== 'string') {
    return false;
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody || JSON.stringify(payload)).digest('hex');
  const provided = signature.replace(/^sha256=/, '');
  if (provided.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

async function recordWebhookEvent(provider: string, payload: any, rawBody: Buffer | undefined, signatureValid: boolean, processed: boolean, errorMessage?: string): Promise<void> {
  if (!dbService.getStatus().connected) {
    return;
  }

  const serializedPayload = rawBody || Buffer.from(JSON.stringify(payload));
  const payloadHash = crypto.createHash('sha256').update(serializedPayload).digest('hex');
  const eventReference = payload?.transactionId || payload?.payment_hash || payload?.checking_id || payload?.id || null;

  await dbService.query(
    `INSERT INTO payment_webhook_events
     (provider, event_reference, payload_hash, signature_valid, processed, error_message)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (provider, payload_hash) DO NOTHING`,
    [provider, eventReference ? String(eventReference) : null, payloadHash, signatureValid, processed, errorMessage || null]
  );
}

export async function resolvePort(requestedPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();

    tester.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(resolvePort(requestedPort + 1));
        return;
      }
      reject(err);
    });

    tester.once("listening", () => {
      tester.close(() => resolve(requestedPort));
    });

    tester.listen(requestedPort, "0.0.0.0");
  });
}

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'ENCRYPTION_KEY'];
    const missing = required.filter(name => !process.env[name]?.trim());
    if (!process.env.DATABASE_URL?.trim() && !process.env.POSTGRES_PASSWORD?.trim()) {
      missing.push('DATABASE_URL or POSTGRES_PASSWORD');
    }
    const lightningProvider = (process.env.LIGHTNING_PROVIDER || 'lnbits').toLowerCase();
    const lightningKey = lightningProvider === 'lnbits' ? process.env.LNBITS_API_KEY : process.env.LIGHTNING_API_KEY;
    const aggregator = (process.env.AGGREGATOR_CHOICE || process.env.FIAT_PROVIDER || 'fedapay').toLowerCase();
    const allowedAggregators = ['cinetpay', 'kkiapay', 'feexpay', 'fedapay', 'izichange'];
    if (!allowedAggregators.includes(aggregator)) missing.push('AGGREGATOR_CHOICE');
    const fiatKey = aggregator === 'fedapay'
      ? process.env.FEDAPAY_SECRET_KEY
      : aggregator === 'kkiapay'
        ? process.env.KKIAPAY_PRIVATE_KEY
        : aggregator === 'cinetpay'
          ? process.env.CINETPAY_API_KEY
          : aggregator === 'feexpay'
            ? process.env.FEEXPAY_API_KEY
            : process.env.IZICHANGE_API_KEY;
    const webhookSecret = aggregator === 'fedapay'
      ? process.env.FEDAPAY_WEBHOOK_SECRET
      : aggregator === 'kkiapay'
        ? process.env.KKIAPAY_WEBHOOK_SECRET || process.env.KKIAPAY_PRIVATE_KEY
        : aggregator === 'cinetpay'
          ? process.env.CINETPAY_WEBHOOK_SECRET
          : aggregator === 'feexpay'
            ? process.env.FEEXPAY_WEBHOOK_SECRET
            : undefined;
    if (!['lnbits', 'breez', 'izichange'].includes(lightningProvider)) missing.push('LIGHTNING_PROVIDER');
    if (lightningKey?.trim() && lightningProvider !== 'lnbits' && !process.env.LIGHTNING_API_URL?.trim()) {
      missing.push('LIGHTNING_API_URL');
    }
    if (aggregator === 'cinetpay' && fiatKey?.trim() && !process.env.CINETPAY_SITE_ID?.trim()) {
      missing.push('CINETPAY_SITE_ID');
    }
    if (missing.length > 0) {
      throw new Error(`Missing production configuration: ${missing.join(', ')}`);
    }
  }
  loadDb();
  await dbService.testAndInit();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production'
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https:', 'wss:'],
            fontSrc: ["'self'", 'data:', 'https:'],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
  }));
  const PORT = Number(process.env.PORT) || 3000;
  // Cloud platforms assign PORT and route traffic to that exact port.
  // Falling back to another port makes the service appear blank or unhealthy.
  const resolvedPort = process.env.NODE_ENV === 'production'
    ? PORT
    : await resolvePort(PORT);

  if (resolvedPort !== PORT) {
    console.warn(`[Santé+ Benin Server] Port ${PORT} occupé, basculement sur ${resolvedPort}.`);
  }

  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  if (process.env.RENDER_EXTERNAL_URL) {
    allowedOrigins.push(process.env.RENDER_EXTERNAL_URL.trim());
  }
  app.use(cors({
    credentials: true,
    origin: (origin, callback) => {
      const isLocalDevelopmentOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(origin || '');
      const isRenderOrigin = origin ? /^https:\/\/[a-zA-Z0-9-]+\.onrender\.com$/.test(origin) : false;
      if (!origin || allowedOrigins.includes(origin) || isLocalDevelopmentOrigin || isRenderOrigin) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed by CORS'));
    },
  }));
  app.use(express.json({
    limit: process.env.NODE_ENV === 'production' ? '256kb' : '2mb',
    verify: (req, _res, buffer) => {
      (req as any).rawBody = Buffer.from(buffer);
    },
  }));

  // Flux temps réel partagé par les espaces patient, médecin et administration.
  app.get('/api/events', (req, res) => {
    const token = typeof req.query.token === 'string'
      ? req.query.token
      : req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('sante_access_token='))?.split('=').slice(1).join('=');
    if (!token) return res.status(401).end();

    let audienceUserId: number | undefined;
    try {
      const decoded: any = jwt.verify(token, authConfig.accessSecret);
      audienceUserId = Number(decoded.id);
    } catch {
      return res.status(401).end();
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(': connected\n\n');

    const unsubscribe = subscribeRealtime((event) => {
      if (event.audienceUserIds?.length && audienceUserId && !event.audienceUserIds.includes(audienceUserId)) {
        return;
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  // HEALTH & MONITORING ENDPOINT
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbService.getStatus(),
      services: {
        lightning: lightningService.isConfigured() ? 'live' : 'sandbox',
        ipfs: ipfsService.isConfigured() ? 'pinata' : 'local_ipfs',
        mobileMoney: 'active',
        aggregator: (process.env.AGGREGATOR_CHOICE || process.env.FIAT_PROVIDER || 'sandbox').toLowerCase(),
        mobileMoneyProvider: momoService.aggregatorChoice,
      }
    });
  });

  app.get('/api/platform/metrics', requireAuth, requireRole('superadmin'), async (_req, res) => {
    res.json({ success: true, data: await getPlatformMetrics() });
  });

  app.get('/api/health/ready', (req, res) => {
    const database = dbService.getStatus();
    const services = {
      database: database.connected,
      lightning: lightningService.isConfigured(),
      ipfs: ipfsService.isConfigured(),
    };
    const isProduction = process.env.NODE_ENV === 'production';
    const ready = !isProduction || Object.values(services).every(Boolean);

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      services,
    });
  });

  // Register API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/patients', patientRoutes);
  app.use('/api/hospitals-admin', hospitalAdminRoutes);
  app.use('/api/payments-v2', paymentRoutes);
  app.use('/api/doctors', doctorRoutes);
  app.use('/api/blood', bloodRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/blockchain', blockchainRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/ipfs', ipfsRoutes);

  app.use('/api', paymentV3Routes);

  // ==========================================================================
  // WEBHOOKS UNIFIÉS MOBILE MONEY (CinetPay, Kkiapay, FeexPay, FedaPay)
  // Signature HMAC + idempotence via payment_webhook_events + paymentService
  // ==========================================================================
  app.post('/api/webhooks/mobile-money', async (req, res) => {
    const provider = (String(req.query.provider || '').toLowerCase() || momoService.aggregatorChoice) as any;
    const allowedProviders = ['cinetpay', 'kkiapay', 'feexpay', 'fedapay', 'izichange', 'sandbox'];
    const normalizedProvider = allowedProviders.includes(provider) ? provider : momoService.aggregatorChoice;
    const signatureHeader =
      req.headers['x-cinetpay-signature'] ||
      req.headers['x-kkiapay-signature'] ||
      req.headers['x-feexpay-signature'] ||
      req.headers['x-fedapay-signature'] ||
      req.headers['x-izichange-signature'] ||
      req.headers['x-webhook-signature'] ||
      req.headers['signature'];
    const rawBody = (req as any).rawBody;
    const signatureValid = momoService.verifyWebhookSignature(
      normalizedProvider,
      rawBody || Buffer.from(JSON.stringify(req.body || {})),
      typeof signatureHeader === 'string' ? signatureHeader : undefined
    );
    const body: any = req.body || {};
    const transactionId =
      body?.transaction_id ||
      body?.transactionId ||
      body?.cpm_trans_id ||
      body?.cpm_custom ||
      body?.id ||
      body?.reference ||
      body?.order_id ||
      body?.checking_id;
    const statusRaw = String(
      body?.status || body?.code || body?.payment_status || body?.state || body?.event || 'UNKNOWN'
    ).toUpperCase();
    const isSuccess =
      statusRaw.includes('SUCCESS') ||
      statusRaw.includes('ACCEPTED') ||
      statusRaw.includes('COMPLETED') ||
      statusRaw.includes('PAID') ||
      statusRaw.includes('00') ||
      statusRaw === 'APPROVED';
    const isFailed =
      statusRaw.includes('FAILED') ||
      statusRaw.includes('REFUSED') ||
      statusRaw.includes('REJECTED') ||
      statusRaw.includes('CANCELLED') ||
      statusRaw.includes('02') ||
      statusRaw === 'DECLINED';
    const amountRaw = Number(
      body?.amount || body?.order_amount || body?.currency_amount || body?.total_amount || 0
    );
    const amountXof = Number.isFinite(amountRaw) && amountRaw > 0 ? Math.floor(amountRaw) : 0;

    // Journaliser l'événement webhook (idempotent via UNIQUE provider+payload_hash)
    try {
      await recordWebhookEvent(
        normalizedProvider,
        body,
        rawBody,
        signatureValid,
        false,
        undefined
      );
    } catch { /* ignore duplicate log */ }

    if (!signatureValid && process.env.NODE_ENV === 'production') {
      try {
        await recordWebhookEvent(
          normalizedProvider,
          body,
          rawBody,
          false,
          false,
          'Invalid HMAC signature in production'
        );
      } catch { /* ignore */ }
      return res.status(403).json({ success: false, error: 'Signature invalide' });
    }

    if (!transactionId || amountXof <= 0) {
      return res.status(200).json({ received: true, processed: false, reason: 'Missing fields' });
    }

    const externalStatus: 'SUCCESS' | 'FAILED' = isSuccess ? 'SUCCESS' : isFailed ? 'FAILED' : 'SUCCESS';
    let processed = false;
    let errorMessage: string | undefined;

    // Double-check via API agrégateur si disponible
    if (isSuccess && dbService.getStatus().connected) {
      try {
        const verify = await momoService.verifyPaymentStatus(
          normalizedProvider,
          String(body?.cpm_trans_id || body?.id || body?.reference || String(transactionId)),
          String(transactionId)
        );
        if (verify.status === 'FAILED') {
          errorMessage = 'Double-check API a refusé la transaction';
        } else if (verify.amount && verify.amount !== amountXof && process.env.NODE_ENV !== 'test') {
          errorMessage = `Montant mismatch API verify ${verify.amount} vs ${amountXof}`;
        }
      } catch (err: any) {
        if (process.env.NODE_ENV === 'production') {
          console.warn('[Webhook MoMo] Double-check échec:', err.message);
        }
      }
    }

    if (dbService.getStatus().connected && !errorMessage) {
      try {
        // 1. Essayer recharge wallet
        const confirmResult = await paymentService.confirmRechargeByTransactionId({
          transactionId: String(transactionId),
          amountXof,
          externalStatus,
          provider: normalizedProvider === 'sandbox' ? 'sandbox' : 'mtn',
        });
        if (confirmResult.success) {
          processed = true;
        }
      } catch (err: any) {
        // 2. Sinon essayer paiement facture
        try {
          const invResult = await paymentService.confirmInvoicePayment({
            transactionId: String(transactionId),
            amountXof,
            externalStatus,
            method: 'mobile_money',
            provider: normalizedProvider === 'sandbox' ? 'sandbox' : 'mtn',
          });
          if (invResult.success) {
            processed = true;
          }
        } catch (err2: any) {
          errorMessage = `Aucune recharge/facture trouvée: ${err.message} / ${err2.message}`;
        }
      }

      try {
        const serializedPayload = rawBody || Buffer.from(JSON.stringify(body || {}));
        const payloadHash = crypto.createHash('sha256').update(serializedPayload).digest('hex');
        const eventReference = transactionId ? String(transactionId) : null;
        await dbService.query(
          `UPDATE payment_webhook_events
             SET processed = $1, error_message = COALESCE($2, error_message)
           WHERE provider = $3 AND payload_hash = $4`,
          [processed, errorMessage || null, normalizedProvider, payloadHash]
        );
      } catch { /* ignore */ }
    }

    // Retour 200 immédiatement indépendamment du traitement (éviter retries agrégateur)
    return res.status(200).json({
      received: true,
      processed,
      provider: normalizedProvider,
      transactionId,
      status: externalStatus,
      amountXof,
    });
  });

  // ==========================================================================
  // WEBHOOK UNIFIÉ LIGHTNING (LNbits / Breez / Izichange)
  // ==========================================================================
  app.post('/api/webhooks/lightning', async (req, res) => {
    const signatureHeader =
      req.headers['x-lnbits-signature'] ||
      req.headers['x-webhook-signature'] ||
      req.headers['signature'];
    const rawBody = (req as any).rawBody;
    const signatureValid = lightningService.verifyWebhookSignature(
      rawBody || Buffer.from(JSON.stringify(req.body || {})),
      typeof signatureHeader === 'string' ? signatureHeader : undefined
    );
    const body: any = req.body || {};
    const paymentHash =
      body?.payment_hash || body?.paymentHash || body?.checking_id || body?.hash || body?.id;
    const amountMsats = Number(body?.amount || body?.amount_msat || body?.amountSats || 0);
    const amountSats = amountMsats > 1e5 ? Math.floor(amountMsats / 1000) : Math.floor(amountMsats);
    const amountXof = Math.max(1, Math.round(amountSats / 1.666));
    const isPaid =
      body?.paid === true ||
      body?.settled === true ||
      body?.status === 'paid' ||
      String(body?.status || '').toUpperCase() === 'COMPLETED' ||
      typeof body?.preimage === 'string';

    try {
      await recordWebhookEvent('lnbits', body, rawBody, signatureValid, false, undefined);
    } catch { /* ignore duplicate */ }

    if (!signatureValid && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, error: 'Signature Lightning invalide' });
    }
    if (!paymentHash) {
      return res.status(200).json({ received: true, processed: false, reason: 'Missing payment_hash' });
    }

    const externalStatus: 'SUCCESS' | 'FAILED' = isPaid ? 'SUCCESS' : 'FAILED';
    let processed = false;
    let errorMessage: string | undefined;

    if (dbService.getStatus().connected) {
      try {
        const r1 = await paymentService.confirmRechargeByTransactionId({
          paymentHash: String(paymentHash),
          amountXof,
          externalStatus,
          provider: 'lnbits',
        });
        if (r1.success) processed = true;
      } catch (errA: any) {
        try {
          const r2 = await paymentService.confirmInvoicePayment({
            paymentHash: String(paymentHash),
            amountXof,
            externalStatus,
            method: 'lightning',
            provider: 'lnbits',
          });
          if (r2.success) processed = true;
        } catch (errB: any) {
          errorMessage = `Lightning webhook: ${errA.message} / ${errB.message}`;
        }
      }

      try {
        const serializedPayload = rawBody || Buffer.from(JSON.stringify(body || {}));
        const payloadHash = crypto.createHash('sha256').update(serializedPayload).digest('hex');
        const eventReference = String(paymentHash);
        await dbService.query(
          `UPDATE payment_webhook_events
             SET processed = $1, error_message = COALESCE($2, error_message)
           WHERE provider = 'lnbits' AND payload_hash = $3`,
          [processed, errorMessage || null, payloadHash]
        );
      } catch { /* ignore */ }
    }

    return res.status(200).json({
      received: true,
      processed,
      paymentHash,
      amountXof,
      amountSats,
      status: externalStatus,
    });
  });

  // 1. GET ALL HOSPITALS
  app.get("/api/hospitals", (req, res) => {
    res.json(HOSPITALS_DB);
  });

  // 1b. POST REGISTER NEW HOSPITAL (PENDING VERIFICATION)
  app.post("/api/hospitals/register", async (req, res) => {
    const { name, type, address, phone, hours, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Le nom, l'email et le mot de passe sont requis." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';
    const userExists = HOSPITAL_USERS_DB.some(u => u.email === normalizedEmail || (normalizedPhone && u.phone === normalizedPhone));
    if (userExists) {
      return res.status(400).json({ error: "Cet email est déjà associé à un compte professionnel." });
    }

    if (dbService.getStatus().connected) {
      const existingUser = await dbService.query<{ id: number }>(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR phone = $2 LIMIT 1',
        [normalizedEmail, normalizedPhone]
      );
      if (existingUser?.rows.length) {
        return res.status(409).json({ error: "Cet email ou ce téléphone est déjà associé à un compte professionnel." });
      }
    }

    const hospitalId = `hosp-${Date.now()}`;
    const newHospital = {
      id: hospitalId,
      name,
      type: type || 'clinic',
      image: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&q=80&w=600',
      rating: 5.0,
      reviewsCount: 0,
      distance: `${(1 + Math.random() * 5).toFixed(1)} km`,
      address: address || "Abomey-Calavi Centre, Bénin",
      phone: normalizedPhone || "+229 01 97 00 00 00",
      hours: hours || "Ouvert 24h/24",
      isVerified: false, // Must be verified by Super Admin
      services: ['Médecine Générale', 'Consultations', 'Urgences'],
      priceList: [
        { name: 'Consultation Médecine Générale', priceXOF: 2000, priceSats: 3330 },
        { name: 'Soin Ambulatoire Simple', priceXOF: 1000, priceSats: 1660 }
      ],
      reviews: [],
      coords: { x: 40 + Math.random() * 30, y: 30 + Math.random() * 30 },
      lat: 6.4385 + (Math.random() - 0.5) * 0.05,
      lng: 2.3412 + (Math.random() - 0.5) * 0.05
    };

    HOSPITALS_DB.push(newHospital);

    HOSPITAL_USERS_DB.push({
      id: nextHospitalUserId(),
      email: normalizedEmail,
      password: bcrypt.hashSync(password, 10),
      hospitalId,
      role: 'admin',
      name: `Admin ${name}`
    });

    saveDb();

    const token = jwt.sign(
      { id: HOSPITAL_USERS_DB[HOSPITAL_USERS_DB.length - 1].id, email: normalizedEmail, role: 'admin', hospitalId, name: `Admin ${name}` },
      process.env.JWT_SECRET as string,
      { expiresIn: "24h" }
    );

    res.status(201).json({
      success: true, 
      token,
      hospitalId,
      message: "Demande de création d'hôpital enregistrée avec succès. Votre établissement est en attente de confirmation par le Super Administrateur Santé+." 
    });
  });

  // 1c. POST ADD NEW HOSPITAL (SUPER ADMIN MANUALLY ADDS, PRE-VERIFIED)
  app.post("/api/hospitals/add", requireAuth, requireRole('superadmin'), (req, res) => {
    const { name, type, address, phone, hours, email, password } = req.body;

    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 160 || (email && !password) || (!email && password)) {
      return res.status(400).json({ error: "Nom d'hôpital ou identifiants invalides." });
    }
    if (email && (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email))) {
      return res.status(400).json({ error: "Adresse email invalide." });
    }
    if (password && (typeof password !== 'string' || password.length < 8 || password.length > 128)) {
      return res.status(400).json({ error: "Le mot de passe doit contenir entre 8 et 128 caractères." });
    }

    const hospitalId = `hosp-${Date.now()}`;
    const newHospital = {
      id: hospitalId,
      name,
      type: type || 'clinic',
      image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=600',
      rating: 5.0,
      reviewsCount: 0,
      distance: `${(1 + Math.random() * 4).toFixed(1)} km`,
      address: address || "Abomey-Calavi Centre, Bénin",
      phone: phone || "+229 01 97 00 00 00",
      hours: hours || "Ouvert 24h/24",
      isVerified: true, // Immediately verified
      services: ['Médecine Générale', 'Consultations', 'Urgences'],
      priceList: [
        { name: 'Consultation Médecine Générale', priceXOF: 2000, priceSats: 3330 },
        { name: 'Soin Ambulatoire Simple', priceXOF: 1000, priceSats: 1660 }
      ],
      reviews: [],
      coords: { x: 30 + Math.random() * 40, y: 30 + Math.random() * 40 },
      lat: 6.4385 + (Math.random() - 0.5) * 0.04,
      lng: 2.3412 + (Math.random() - 0.5) * 0.04
    };

    HOSPITALS_DB.push(newHospital);

    if (email && password) {
      HOSPITAL_USERS_DB.push({
        id: nextHospitalUserId(),
        email: email.toLowerCase().trim(),
        password: bcrypt.hashSync(password, 10),
        hospitalId,
        role: 'admin',
        name: `Admin ${name}`
      });
    }

    saveDb();

    res.status(201).json({ success: true, hospital: newHospital });
  });

  // 1d. PATCH VERIFY HOSPITAL (SUPER ADMIN CONFIRMS)
  app.patch("/api/hospitals/:id/verify", requireAuth, requireRole('superadmin'), (req, res) => {
    const { id } = req.params;
    const hospital = HOSPITALS_DB.find(h => h.id === id);
    if (!hospital) {
      return res.status(404).json({ error: "Établissement non trouvé" });
    }

    hospital.isVerified = true;
    saveDb();
    res.json({ success: true, hospital });
  });

  // 1f. POST REGISTER DOCTOR (PROFESSIONAL AUTHENTICATION STORE)
  app.post("/api/hospital-users/register/doctor", async (req, res) => {
    const { email, phone, password, firstName, lastName, specialty } = req.body;

    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) ||
        typeof phone !== 'string' || phone.trim().length < 8 ||
        typeof password !== 'string' || password.length < 8 || password.length > 128 ||
        typeof firstName !== 'string' || firstName.trim().length < 2) {
      return res.status(400).json({ success: false, error: "Informations médecin invalides." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingProfessional = HOSPITAL_USERS_DB.find(user => user.email?.toLowerCase() === normalizedEmail);
    if (existingProfessional) {
      return res.status(409).json({ success: false, error: "Cet email professionnel est déjà enregistré." });
    }

    let user: any;
    if (dbService.getStatus().connected) {
      user = await dbService.transaction(async client => {
        const result = await client.query(
          `INSERT INTO users (email, phone, password_hash, role)
           VALUES ($1, $2, $3, 'doctor')
           RETURNING id, email, phone, role, password_hash`,
          [normalizedEmail, phone.trim(), bcrypt.hashSync(password, 10)]
        );
        const createdUser = result.rows[0];
        await client.query(
          `INSERT INTO doctors (user_id, first_name, last_name, specialty, license_number, npi)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [createdUser.id, firstName.trim(), (lastName || 'ONMB').trim(), specialty || 'Médecine générale',
           `BJ-MED-${createdUser.id}`, `BJ${String(createdUser.id).padStart(11, '0')}`]
        );
        return createdUser;
      });
    } else {
      user = {
        id: nextHospitalUserId(),
        email: normalizedEmail,
        phone: phone.trim(),
        password: bcrypt.hashSync(password, 10),
        hospitalId: 'hz-calavi',
        role: 'doctor',
        name: `Dr. ${firstName.trim()}`
      };
      HOSPITAL_USERS_DB.push(user);
      saveDb();
    }

    if (!user) {
      return res.status(500).json({ success: false, error: "Impossible de créer le compte médecin." });
    }

    const hospitalId = user.hospitalId || 'hz-calavi';
    const name = user.name || `Dr. ${firstName.trim()}`;
    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'doctor', hospitalId, name },
      process.env.JWT_SECRET as string,
      { expiresIn: "24h" }
    );
    setProfessionalAuthCookie(res, token);

    res.status(201).json({ success: true, token, email: user.email, hospitalId, role: 'doctor', name });
  });

  // 1e. POST HOSPITAL LOGIN (AUTHENTICATION WITH ACTUAL PASSWORD AND VERIFICATION CHECK)
  app.post("/api/hospital-users/login", loginRateLimit, async (req, res) => {
    const { email, password, expectedRole } = req.body;
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: "L'email et le mot de passe sont requis." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user: any;

    if (dbService.getStatus().connected) {
      const result = await dbService.query<any>(
        `SELECT u.id, u.email, u.phone, u.role, u.password_hash AS password,
                d.hospital_id AS "hospitalId",
                COALESCE(d.first_name || ' ' || d.last_name, u.email) AS name
         FROM users u LEFT JOIN doctors d ON d.user_id = u.id
         WHERE LOWER(u.email) = LOWER($1) AND u.role IN ('doctor', 'admin', 'superadmin')
         LIMIT 1`,
        [normalizedEmail]
      );
      user = result?.rows[0];
      if (!user) {
        user = HOSPITAL_USERS_DB.find(u => u.email === normalizedEmail);
      }
    } else {
      user = HOSPITAL_USERS_DB.find(u => u.email === normalizedEmail);
    }

    if (!user) {
      return res.status(401).json({ error: "Identifiants incorrects." });
    }

    const isMatch = isBcryptHash(user.password) && bcrypt.compareSync(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Identifiants incorrects." });
    }

    if (expectedRole && !['doctor', 'admin'].includes(expectedRole)) {
      return res.status(400).json({ error: 'Rôle professionnel invalide.' });
    }

    if (expectedRole && expectedRole !== user.role) {
      return res.status(403).json({
        error: expectedRole === 'doctor'
          ? 'Ce compte n’est pas un compte médecin. Utilisez un compte praticien.'
          : 'Ce compte n’est pas un compte administrateur hospitalier.',
      });
    }


    // Check if hospital is verified (unless super admin)
    if (user.hospitalId && user.hospitalId !== "system-admin") {
      const hospital = HOSPITALS_DB.find(h => h.id === user.hospitalId);
      if (hospital && !hospital.isVerified) {
        return res.status(403).json({ 
          error: "Votre établissement est en attente de confirmation par le Super Administrateur Santé+." 
        });
      }
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, hospitalId: user.hospitalId, name: user.name },
      process.env.JWT_SECRET as string,
      { expiresIn: "24h" }
    );
    recordPlatformSession(Number(user.id), user.role);
    setProfessionalAuthCookie(res, token);

    res.json({
      token,
      email: user.email,
      hospitalId: user.hospitalId,
      role: user.role,
      name: user.name
    });
  });

  // 2. POST HOSPITAL REVIEW
  app.post("/api/hospitals/:id/reviews", (req, res) => {
    const hospitalId = req.params.id;
    const { author, rating, comment } = req.body;

    const hospital = HOSPITALS_DB.find(h => h.id === hospitalId);
    if (!hospital) {
      return res.status(404).json({ error: "Hôpital non trouvé" });
    }

    const newReview = {
      id: `rev-${Math.floor(1000 + Math.random() * 9000)}`,
      author: author || "Citoyen Anonyme",
      rating: Number(rating) || 5,
      date: new Date().toLocaleDateString('fr-FR'),
      comment: comment || ""
    };

    hospital.reviews.push(newReview);
    const totalRating = hospital.reviews.reduce((sum, r) => sum + r.rating, 0);
    hospital.rating = Number((totalRating / hospital.reviews.length).toFixed(1));
    hospital.reviewsCount = hospital.reviews.length;

    saveDb();

    res.json(newReview);
  });

  // 3. GET APPOINTMENTS
  app.get("/api/appointments", requireAuth, requireRole('patient', 'doctor', 'admin'), async (req, res) => {
    const requesterRole = (req as any).userRole;
    const requesterId = Number((req as any).userId);
    if (dbService.getStatus().connected) {
      const result = await dbService.query(
        `SELECT a.id, a.scheduled_at AS "scheduledAt", a.service, a.reason, a.status,
                a.payment_method AS "paymentMethod", a.amount_xof AS "amountPaidXOF",
                a.amount_sats AS "amountPaidSats", a.is_paid AS "isPaid",
                p.first_name || ' ' || p.last_name AS "patientName", u.email AS "patientEmail",
                h.name AS "hospitalName"
         FROM appointments a
         LEFT JOIN patients p ON p.id = a.patient_id
         LEFT JOIN users u ON u.id = p.user_id
         LEFT JOIN hospitals h ON h.id = a.hospital_id
         WHERE ($1 = 'admin'
           OR ($1 = 'patient' AND p.user_id = $2)
           OR ($1 = 'doctor' AND EXISTS (
             SELECT 1 FROM doctors d2 WHERE d2.user_id = $2 AND d2.id = a.doctor_id
           )))
         ORDER BY a.scheduled_at DESC`
        , [requesterRole, requesterId]
      );
      return res.json(result?.rows || []);
    }

    const visibleAppointments = requesterRole === 'patient'
      ? APPOINTMENTS_DB.filter(appointment => ownsPatientEmailInFallback(requesterId, appointment.patientEmail || ''))
      : APPOINTMENTS_DB;
    res.json(visibleAppointments);
  });

  // 4. POST APPOINTMENT (With Instant Payment & Credit Management)
  app.post("/api/appointments", requireAuth, requireRole('patient', 'doctor', 'admin'), async (req, res) => {
    const { 
      hospitalId, 
      hospitalName, 
      date, 
      timeSlot, 
      patientName, 
      patientEmail,
      service, 
      reason, 
      doctorName,
      paymentMethod
    } = req.body;

    const normalizedEmail = patientEmail ? patientEmail.toLowerCase().trim() : '';
    if ((req as any).userRole === 'patient' && !(await ownsPatientEmail(Number((req as any).userId), normalizedEmail))) {
      return res.status(403).json({ error: 'Le rendez-vous doit appartenir au patient authentifié.' });
    }
    const patient = PATIENTS_DB[normalizedEmail];

    const costXOF = 2000;
    const costSats = 3330;

    let finalPaymentMethod = paymentMethod || 'Free';
    let finalIsPaid = false;

    if (paymentMethod === 'Wallet') {
      if (!patient) {
        return res.status(404).json({ error: "Citoyen non trouvé pour le paiement." });
      }
      if (patient.walletBalance < costXOF) {
        return res.status(400).json({ error: `Solde insuffisant dans votre portefeuille Santé+ (${patient.walletBalance} XOF dispos vs ${costXOF} XOF requis pour le RDV)` });
      }
      patient.walletBalance -= costXOF;
      finalIsPaid = true;
    } else if (paymentMethod === 'Lightning') {
      if (!patient) {
        return res.status(404).json({ error: "Citoyen non trouvé pour le paiement." });
      }
      const balance = patient.satoshiBalance !== undefined ? patient.satoshiBalance : 20000;
      if (balance < costSats) {
        return res.status(400).json({ error: `Solde Satoshi insuffisant dans votre portefeuille Lightning (${balance} Sats dispos vs ${costSats} Sats requis pour le RDV)` });
      }
      patient.satoshiBalance = balance - costSats;
      finalIsPaid = true;
    } else if (paymentMethod === 'Credit') {
      // Look for a cancelled, paid appointment that hasn't been reused yet
      let cancelledPaidApt = APPOINTMENTS_DB.find(apt => 
        apt.patientEmail?.toLowerCase().trim() === normalizedEmail &&
        apt.status === 'cancelled' &&
        apt.isPaid &&
        apt.creditAvailable &&
        (!apt.creditExpiresAt || new Date(apt.creditExpiresAt).getTime() > Date.now())
      );

      if (dbService.getStatus().connected) {
        const creditResult = await dbService.query<any>(
          `SELECT a.id
           FROM appointments a
           JOIN patients p ON p.id = a.patient_id
           JOIN users u ON u.id = p.user_id
           WHERE LOWER(u.email) = LOWER($1)
             AND a.status = 'cancelled' AND a.is_paid = TRUE AND a.credit_available = TRUE
             AND (a.credit_expires_at IS NULL OR a.credit_expires_at > CURRENT_TIMESTAMP)
           ORDER BY a.updated_at ASC LIMIT 1`,
          [normalizedEmail]
        );
        cancelledPaidApt = creditResult?.rows[0];
      }

      if (cancelledPaidApt) {
        if (dbService.getStatus().connected) {
          await dbService.query(
            `UPDATE appointments SET credit_available = FALSE, credit_used_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [cancelledPaidApt.id]
          );
        } else {
          cancelledPaidApt.creditAvailable = false;
          cancelledPaidApt.creditUsedBy = `apt-${Date.now()}`;
        }
        finalIsPaid = true;
        finalPaymentMethod = 'Credit';
      } else {
        return res.status(400).json({ error: "Aucun crédit de consultation gratuit n'a été trouvé suite à une annulation de rendez-vous payé." });
      }
    } else {
      // Default to Free or Pending if no payment method provided
      finalIsPaid = false;
      finalPaymentMethod = 'Free';
    }

    const newAppointment = {
      id: req.body.id || `apt-${Math.floor(100 + Math.random() * 900)}`,
      hospitalId,
      hospitalName,
      date,
      timeSlot,
      patientName,
      patientEmail: normalizedEmail,
      status: 'confirmed',
      service: service || 'Médecine Générale',
      reason: reason || 'Consultation générale',
      doctorName: doctorName || undefined,
      isPaid: finalIsPaid,
      paymentMethod: finalPaymentMethod,
      amountPaidXOF: finalPaymentMethod === 'Wallet' ? costXOF : 0,
      amountPaidSats: finalPaymentMethod === 'Lightning' ? costSats : 0,
      creditAvailable: false,
      creditExpiresAt: undefined,
      createdAt: new Date().toISOString()
    };

    APPOINTMENTS_DB.unshift(newAppointment);
    if (dbService.getStatus().connected) {
      await dbService.query(
        `INSERT INTO appointments
         (id, patient_id, hospital_id, scheduled_at, service, reason, status,
          payment_method, amount_xof, amount_sats, is_paid, credit_available, credit_expires_at)
         VALUES ($1,
           (SELECT p.id FROM patients p JOIN users u ON u.id = p.user_id WHERE LOWER(u.email) = LOWER($2) LIMIT 1),
           (SELECT id FROM hospitals WHERE name = $3 LIMIT 1),
           $4::timestamp, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          newAppointment.id,
          normalizedEmail,
          hospitalName,
          `${date} ${timeSlot}`,
          newAppointment.service,
          newAppointment.reason,
          newAppointment.status,
          newAppointment.paymentMethod,
          newAppointment.amountPaidXOF,
          newAppointment.amountPaidSats,
          newAppointment.isPaid,
          newAppointment.creditAvailable,
          newAppointment.creditExpiresAt || null,
        ]
      );
    }
    saveDb();
    publishRealtimeEvent({ type: 'created', entity: 'appointment', entityId: newAppointment.id });
    res.status(201).json({ appointment: newAppointment, patient });
  });

  // 4b. PATCH CONFIRM APPOINTMENT
  app.patch("/api/appointments/:id/confirm", requireAuth, requireRole('doctor', 'admin'), async (req, res) => {
    const { id } = req.params;
    const appointment = APPOINTMENTS_DB.find(apt => apt.id === id);
    if (!appointment) {
      return res.status(404).json({ error: "Rendez-vous introuvable" });
    }
    appointment.status = 'confirmed';
    if (dbService.getStatus().connected) {
      await dbService.query('UPDATE appointments SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', ['confirmed', id]);
    }
    saveDb();
    publishRealtimeEvent({ type: 'updated', entity: 'appointment', entityId: id });
    res.json(appointment);
  });

  // 5. DELETE APPOINTMENT (Cancellation! Keeps historical entries to prevent disputes)
  app.delete("/api/appointments/:id", requireAuth, requireRole('patient', 'doctor', 'admin'), async (req, res) => {
    const { id } = req.params;
    const reason = req.query.reason || req.body.reason || "Annulation à la demande du patient";
    
    const appointment = APPOINTMENTS_DB.find(apt => apt.id === id);
    if (!appointment) {
      return res.status(404).json({ error: "Rendez-vous introuvable" });
    }
    if ((req as any).userRole === 'patient' && !(await ownsPatientEmail(Number((req as any).userId), appointment.patientEmail || ''))) {
      return res.status(403).json({ error: 'Ce rendez-vous ne vous appartient pas.' });
    }

    appointment.status = 'cancelled';
    appointment.cancellationReason = String(reason);

    // If appointment was paid and wasn't already a free credit, make a credit available for rebooking!
    if (appointment.isPaid && appointment.paymentMethod !== 'Credit') {
      appointment.creditAvailable = true;
      appointment.creditExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    if (dbService.getStatus().connected) {
      await dbService.query(
        `UPDATE appointments
         SET status = 'cancelled', cancellation_reason = $1, credit_available = $2,
           credit_expires_at = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [String(reason), appointment.creditAvailable, appointment.creditExpiresAt || null, id]
      );
    }

    // Return updated profile if possible
    const patient = appointment.patientEmail ? PATIENTS_DB[appointment.patientEmail.toLowerCase().trim()] : null;

    saveDb();
    publishRealtimeEvent({ type: 'updated', entity: 'appointment', entityId: id });

    res.json({ 
      success: true, 
      message: "Rendez-vous annulé avec succès. L'historique a été conservé.", 
      appointment,
      patient
    });
  });

  // 5c. GET MEDICAL DOCUMENTS (Citizen Health Dossier)
  app.get("/api/medical-documents", requireAuth, requireRole('patient', 'doctor', 'admin'), async (req, res) => {
    const { npi } = req.query;
    const requesterRole = (req as any).userRole;
    const requesterId = (req as any).userId;
    if (dbService.getStatus().connected) {
      const result = await dbService.query(
        `SELECT d.id, d.title, d.document_type AS type, d.items, d.history, d.notes,
                d.price_xof AS "priceXOF", d.price_sats AS "priceSats",
                d.created_at AS "createdAt", p.npi AS "patientNpi",
                h.name AS "hospitalName", doc.first_name || ' ' || doc.last_name AS "doctorName",
                du.email AS "doctorEmail"
         FROM medical_documents d
         LEFT JOIN patients p ON p.id = d.patient_id
         LEFT JOIN hospitals h ON h.id = d.hospital_id
         LEFT JOIN doctors doc ON doc.id = d.doctor_id
         LEFT JOIN users du ON du.id = doc.user_id
         WHERE (
           ($2 = 'patient' AND p.user_id = $3)
           OR ($2 = 'doctor' AND EXISTS (
             SELECT 1 FROM doctor_patients dp
             WHERE dp.patient_id = p.id AND dp.doctor_user_id = $3
           ))
           OR ($2 = 'admin' AND ($1::text IS NULL OR p.npi = $1))
         )
         ORDER BY d.created_at DESC`,
        [npi ? String(npi) : null, requesterRole, requesterId]
      );
      return res.json((result?.rows || []).map(document => ({
        ...document,
        hospitalId: undefined,
        date: new Date(document.createdAt).toLocaleDateString('fr-FR'),
      })));
    }
    if (requesterRole === 'patient') {
      const raw = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) : {};
      const patientUser = (raw.AUTH_USERS_DB || []).find((user: any) => Number(user.id) === Number(requesterId));
      const profile = patientUser ? (raw.PATIENTS_DB || {})[patientUser.email] : undefined;
      const citizenDocs = MEDICAL_DOCUMENTS_DB.filter(d => d.patientNpi === String(profile?.npi || `BJ${String(requesterId).padStart(11, '0')}`));
      return res.json(citizenDocs);
    }
    if (npi) {
      const citizenDocs = MEDICAL_DOCUMENTS_DB.filter(d => d.patientNpi === String(npi));
      return res.json(citizenDocs);
    }
    res.json(MEDICAL_DOCUMENTS_DB);
  });

  // 5d. POST MEDICAL DOCUMENT (Create new entry)
  app.post("/api/medical-documents", requireAuth, requireRole('doctor', 'admin'), async (req, res) => {
    const { 
      patientNpi, 
      title, 
      type, 
      items, 
      priceXOF, 
      priceSats, 
      doctorName, 
      doctorEmail, 
      hospitalId, 
      hospitalName, 
      notes 
    } = req.body;

    if (!patientNpi) {
      return res.status(400).json({ error: "Le NPI du patient est obligatoire." });
    }

    const requesterId = Number((req as any).userId);
    const requesterRole = (req as any).userRole;
    if (dbService.getStatus().connected) {
      const access = await dbService.query(
        `SELECT 1 FROM patients p
         WHERE p.npi = $1 AND (
           $2 = 'admin' OR EXISTS (
             SELECT 1 FROM doctor_patients dp
             JOIN doctors d ON d.id = dp.doctor_user_id
             WHERE dp.patient_id = p.id AND d.user_id = $3
           )
         ) LIMIT 1`,
        [String(patientNpi), requesterRole, requesterId]
      );
      if (!access?.rows[0]) return res.status(403).json({ error: 'Accès patient non autorisé.' });
    } else if (requesterRole === 'doctor') {
      let linked = false;
      try {
        const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        linked = (raw.DOCTOR_PATIENTS_DB || []).some((item: any) =>
          item.npi === String(patientNpi) && String(item.doctorId) === String(requesterId)
        );
      } catch {
        linked = false;
      }
      if (!linked) return res.status(403).json({ error: 'Accès patient non autorisé.' });
    }

    const newDoc = {
      id: req.body.id || `doc-${Math.floor(1000 + Math.random() * 9000)}`,
      patientNpi: String(patientNpi),
      title: title || `${type.toUpperCase()} - ${hospitalName}`,
      type: type || 'devis',
      priceXOF: Number(priceXOF) || 0,
      priceSats: Number(priceSats) || 0,
      hospitalId: hospitalId || 'hz-calavi',
      hospitalName: hospitalName || "Hôpital",
      doctorName: doctorName || 'Praticien',
      doctorEmail: doctorEmail || 'medecin@sante.bj',
      date: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}),
      items: items || [],
      notes: notes || '',
      history: []
    };

    MEDICAL_DOCUMENTS_DB.unshift(newDoc);
    if (dbService.getStatus().connected) {
      const patientResult = await dbService.query<{ id: number }>(
        'SELECT id FROM patients WHERE npi = $1 LIMIT 1',
        [newDoc.patientNpi]
      );
      if (!patientResult?.rows[0]) {
        MEDICAL_DOCUMENTS_DB.shift();
        return res.status(404).json({ error: "Patient introuvable pour ce NPI." });
      }

      await dbService.query(
        `INSERT INTO medical_documents
         (id, patient_id, doctor_id, hospital_id, title, document_type, items, history,
          notes, price_xof, price_sats, status)
         VALUES ($1,
           (SELECT id FROM patients WHERE npi = $2 LIMIT 1),
           (SELECT d.id FROM doctors d JOIN users u ON u.id = d.user_id WHERE LOWER(u.email) = LOWER($3) LIMIT 1),
           (SELECT id FROM hospitals WHERE name = $4 LIMIT 1),
           $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, 'issued')`,
        [
          newDoc.id,
          newDoc.patientNpi,
          newDoc.doctorEmail,
          newDoc.hospitalName,
          newDoc.title,
          newDoc.type,
          JSON.stringify(newDoc.items),
          JSON.stringify(newDoc.history),
          newDoc.notes,
          newDoc.priceXOF,
          newDoc.priceSats,
        ]
      );
    }
    saveDb();
    publishRealtimeEvent({ type: 'created', entity: 'medical-document', entityId: newDoc.id });
    res.status(201).json(newDoc);
  });

  // 5e. PATCH MEDICAL DOCUMENT (Edit entry and log historical changes)
  app.patch("/api/medical-documents/:id", requireAuth, requireRole('doctor', 'admin'), async (req, res) => {
    const { id } = req.params;
    const { title, type, items, priceXOF, priceSats, doctorName, doctorEmail, notes, updateReason } = req.body;

    const doc = MEDICAL_DOCUMENTS_DB.find(d => d.id === id);
    if (!doc) {
      return res.status(404).json({ error: "Document médical introuvable" });
    }

    // Build description of changes for the audit log
    const changeDetails: string[] = [];
    if (title && title !== doc.title) {
      changeDetails.push(`Titre modifié de "${doc.title}" à "${title}"`);
      doc.title = title;
    }
    if (type && type !== doc.type) {
      changeDetails.push(`Catégorie modifiée de "${doc.type}" à "${type}"`);
      doc.type = type;
    }
    if (priceXOF !== undefined && Number(priceXOF) !== doc.priceXOF) {
      changeDetails.push(`Prix XOF modifié de ${doc.priceXOF} à ${priceXOF}`);
      doc.priceXOF = Number(priceXOF);
    }
    if (priceSats !== undefined && Number(priceSats) !== doc.priceSats) {
      changeDetails.push(`Prix Sats modifié de ${doc.priceSats} à ${priceSats}`);
      doc.priceSats = Number(priceSats);
    }
    if (notes !== undefined && notes !== doc.notes) {
      changeDetails.push(`Observations cliniques modifiées`);
      doc.notes = notes;
    }
    if (items) {
      changeDetails.push(`Actes/Produits mis à jour`);
      doc.items = items;
    }

    const finalReason = updateReason || (changeDetails.length > 0 ? changeDetails.join(', ') : "Modifications générales");

    const emailSuffix = doctorEmail ? ` (${doctorEmail})` : '';
    const modificationLog = {
      modifiedAt: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}),
      modifiedBy: (doctorName || 'Praticien') + emailSuffix,
      changes: finalReason
    };

    if (!doc.history) {
      doc.history = [];
    }
    doc.history.push(modificationLog);

    if (dbService.getStatus().connected) {
      await dbService.query(
        `UPDATE medical_documents
         SET title = $1, document_type = $2, items = $3::jsonb, notes = $4,
             price_xof = $5, price_sats = $6, history = $7::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8`,
        [
          doc.title,
          doc.type,
          JSON.stringify(doc.items),
          doc.notes,
          doc.priceXOF,
          doc.priceSats,
          JSON.stringify(doc.history),
          id,
        ]
      );
    }

    saveDb();
    publishRealtimeEvent({ type: 'updated', entity: 'medical-document', entityId: id });

    res.json(doc);
  });

  // 5f. POST DOCTOR SENDS DOCUMENTS + INVOICE + PAYMENT QR TO PATIENT
  app.post("/api/medical-documents/:id/send-to-patient", requireAuth, requireRole('doctor', 'admin'), (req, res) => {
    const { id } = req.params;
    const { patientEmail, attachmentType, invoiceTotal, paymentQrCode, paymentReference } = req.body;

    const doc = MEDICAL_DOCUMENTS_DB.find(d => d.id === id);
    if (!doc) {
      return res.status(404).json({ error: "Document médical introuvable" });
    }

    // Mark document as sent and hash the content for integrity
    const docContent = JSON.stringify({
      title: doc.title,
      items: doc.items,
      notes: doc.notes,
      priceXOF: doc.priceXOF,
      priceSats: doc.priceSats,
      date: doc.date
    });
    const contentHash = sha256(docContent);

    const sentRecord = {
      sentAt: new Date().toISOString(),
      sentTo: patientEmail,
      attachmentType: attachmentType || 'medical-record',  // 'medical-record', 'prescription', 'invoice', 'receipt'
      contentHash: contentHash,
      paymentReference: paymentReference || null,
      paymentQrCode: paymentQrCode || null,
      invoiceTotal: invoiceTotal || doc.priceXOF
    };

    if (!doc.sentHistory) {
      doc.sentHistory = [];
    }
    doc.sentHistory.push(sentRecord);

    // Auto-create invoice if payment reference provided
    if (paymentReference && invoiceTotal) {
      const invoice = {
        id: `FACT-${Math.floor(100000 + Math.random() * 900000)}`,
        documentId: id,
        patientName: doc.patientNpi || 'Patient',
        patientEmail: patientEmail,
        hospitalName: doc.hospitalName,
        date: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}),
        items: doc.items || [],
        totalXOF: Number(invoiceTotal) || 0,
        totalSats: Math.round((Number(invoiceTotal) || 0) * XOF_TO_SATS),
        paymentMethod: 'Pending',
        txHash: `ref_${paymentReference}`,
        isPaid: false,
        doctorName: doc.doctorName,
        paymentQrCode: paymentQrCode || null,
        contentHash: contentHash  // For blockchain anchor later
      };

      INVOICES_DB.push(invoice);
    }

    saveDb();

    res.status(200).json({
      success: true,
      message: "Document envoyé au patient avec référence de paiement",
      sent: sentRecord,
      contentHash: contentHash
    });
  });

  // 5g. GET DOCTOR'S PATIENT NOTIFICATIONS (Documents/Invoices sent)
  app.get("/api/doctor/sent-documents/:doctorEmail", (req, res) => {
    const { doctorEmail } = req.params;

    const sentDocs = MEDICAL_DOCUMENTS_DB
      .filter(d => d.doctorEmail?.toLowerCase() === doctorEmail.toLowerCase())
      .map(d => ({
        id: d.id,
        title: d.title,
        type: d.type,
        sentHistory: d.sentHistory || [],
        priceXOF: d.priceXOF,
        priceSats: d.priceSats
      }));

    res.json(sentDocs);
  });

  // 5h. GET PATIENT RECEIVED DOCUMENTS & INVOICES (Real-time notifications)
  app.get("/api/patient/received-documents/:patientEmail", requireAuth, requireRole('patient'), async (req, res) => {
    const { patientEmail } = req.params;
    const normalizedEmail = patientEmail.toLowerCase().trim();
    if (!(await ownsPatientEmail(Number((req as any).userId), normalizedEmail))) {
      return res.status(403).json({ error: 'Profil patient non autorisé.' });
    }

    // Collect all documents sent to this patient
    const receivedDocs = MEDICAL_DOCUMENTS_DB
      .filter(d => d.sentHistory?.some((s: any) => s.sentTo?.toLowerCase() === normalizedEmail))
      .map(d => ({
        id: d.id,
        title: d.title,
        type: d.type,
        doctorName: d.doctorName,
        hospitalName: d.hospitalName,
        sentHistory: d.sentHistory?.filter((s: any) => s.sentTo?.toLowerCase() === normalizedEmail) || [],
        history: d.history || []  // Full change history for transparency
      }));

    // Also collect invoices related to those documents
    const relatedInvoices = INVOICES_DB.filter(inv =>
      inv.patientEmail?.toLowerCase() === normalizedEmail &&
      (inv.documentId || receivedDocs.some(d => d.id === inv.documentId))
    );

    res.json({
      documents: receivedDocs,
      invoices: relatedInvoices,
      lastUpdate: new Date().toISOString()
    });
  });

  // 5i. PATCH AUTO-GENERATE INVOICE AFTER APPOINTMENT (Called by hospital after appointment)
  app.post("/api/appointments/:appointmentId/generate-invoice", requireAuth, requireRole('doctor', 'admin'), (req, res) => {
    const { appointmentId } = req.params;
    const { invoiceItems, notes } = req.body;

    const appointment = APPOINTMENTS_DB.find(apt => apt.id === appointmentId);
    if (!appointment) {
      return res.status(404).json({ error: "Rendez-vous non trouvé" });
    }

    // Calculate total
    const itemsArray = invoiceItems || [
      { name: `Consultation - ${appointment.service}`, priceXOF: 2000, priceSats: 3330 }
    ];
    const totalXOF = itemsArray.reduce((sum: number, item: any) => sum + (Number(item.priceXOF) || 0), 0);
    const totalSats = Math.round(totalXOF * XOF_TO_SATS);

    const invoice = {
      id: `FACT-${Math.floor(100000 + Math.random() * 900000)}`,
      appointmentId: appointmentId,
      patientName: appointment.patientName,
      patientEmail: appointment.patientEmail,
      hospitalName: appointment.hospitalName,
      date: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}),
      items: itemsArray,
      totalXOF,
      totalSats,
      paymentMethod: 'Pending',
      txHash: `apt_${appointmentId}`,
      isPaid: false,
      doctorName: appointment.doctorName || 'Dr. Consulted',
      notes: notes || appointment.reason
    };

    INVOICES_DB.push(invoice);
    saveDb();
    publishRealtimeEvent({ type: 'created', entity: 'invoice', entityId: invoice.id });

    res.status(201).json({
      success: true,
      invoice: invoice,
      message: "Facture générée automatiquement après rendez-vous"
    });
  });

  // 5j. POST REQUEST BLOCKCHAIN ANCHOR (For document integrity verification)
  app.post("/api/documents/:documentId/request-blockchain-anchor", requireAuth, requireRole('doctor', 'admin'), (req, res) => {
    const { documentId } = req.params;
    const { contentHash } = req.body;

    const doc = MEDICAL_DOCUMENTS_DB.find(d => d.id === documentId);
    if (!doc) {
      return res.status(404).json({ error: "Document introuvable" });
    }

    // In production, this would interact with Bitcoin testnet or mainnet
    // For now, create a pending blockchain anchor record
    const anchorId = `anchor_${sha256(documentId + Date.now())}`;
    BLOCKCHAIN_ANCHORS[anchorId] = {
      hash: contentHash || sha256(JSON.stringify(doc)),
      timestamp: new Date().toISOString(),
      status: 'pending',
      documentId: documentId,
      bitcoinAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'  // Example testnet address
    };

    // Simulate blockchain submission (in production, use Mempool or similar)
    setTimeout(() => {
      if (BLOCKCHAIN_ANCHORS[anchorId]) {
        BLOCKCHAIN_ANCHORS[anchorId].status = 'confirmed';
        BLOCKCHAIN_ANCHORS[anchorId].txid = `btc_tx_${Math.random().toString(36).substring(2, 15)}`;
      }
    }, 5000);  // Simulate 5-second confirmation

    res.status(202).json({
      success: true,
      anchorId: anchorId,
      status: 'pending',
      message: "Demande d'ancrage blockchain en cours. Vérification en ~10 minutes.",
      hash: BLOCKCHAIN_ANCHORS[anchorId].hash,
      bitcoinAddress: BLOCKCHAIN_ANCHORS[anchorId].bitcoinAddress
    });
  });

  // 5k. GET BLOCKCHAIN ANCHOR STATUS (Verify document integrity)
  app.get("/api/documents/:documentId/anchor-status", requireAuth, requireRole('patient', 'doctor', 'admin'), (req, res) => {
    const { documentId } = req.params;

    const anchors = Object.values(BLOCKCHAIN_ANCHORS).filter(a => a.documentId === documentId);

    if (anchors.length === 0) {
      return res.status(404).json({ error: "Pas d'ancrage blockchain trouvé pour ce document" });
    }

    const latestAnchor = anchors[anchors.length - 1];

    res.json({
      documentId: documentId,
      anchor: latestAnchor,
      verified: latestAnchor.status === 'confirmed',
      message: latestAnchor.status === 'confirmed'
        ? `Document vérifié et ancré à ${latestAnchor.timestamp}`
        : `Ancrage en cours... Status: ${latestAnchor.status}`
    });
  });

  // 5l. VERIFY DOCUMENT INTEGRITY (SHA-256 hash check)
  app.post("/api/documents/:documentId/verify-integrity", requireAuth, requireRole('patient', 'doctor', 'admin'), (req, res) => {
    const { documentId } = req.params;
    const { providedHash } = req.body;

    const doc = MEDICAL_DOCUMENTS_DB.find(d => d.id === documentId);
    if (!doc) {
      return res.status(404).json({ error: "Document introuvable" });
    }

    const docContent = JSON.stringify({
      title: doc.title,
      items: doc.items,
      notes: doc.notes,
      priceXOF: doc.priceXOF,
      priceSats: doc.priceSats,
      date: doc.date
    });
    const computedHash = sha256(docContent);

    const isValid = computedHash === providedHash;

    res.json({
      documentId: documentId,
      computedHash: computedHash,
      providedHash: providedHash,
      isValid: isValid,
      message: isValid ? "Document vérifié - Aucune modification détectée" : "Attention: Document modifié depuis l'envoi",
      anchors: Object.values(BLOCKCHAIN_ANCHORS).filter(a => a.documentId === documentId)
    });
  });

  // 5b. POST CREATE PATIENT PROFILE ON SIGNUP
  app.post("/api/wallet/patients", requireAuth, requireRole('patient'), async (req, res) => {
    const { email, name, phone, npi, walletBalance, satoshiBalance } = req.body;
    if (!email) {
      return res.status(400).json({ error: "L'email est requis." });
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (!(req as any).userId) return res.status(401).json({ error: 'Authentification requise.' });
    if (!(await ownsPatientEmail(Number((req as any).userId), normalizedEmail))) {
      return res.status(403).json({ error: 'Profil patient non autorisé.' });
    }

    PATIENTS_DB[normalizedEmail] = {
      name: name || normalizedEmail.split("@")[0].replace(".", " "),
      email: normalizedEmail,
      phone: phone || "+229 01 97 00 00 00",
      walletBalance: Number(walletBalance) !== undefined ? Number(walletBalance) : 15000,
      satoshiBalance: Number(satoshiBalance) !== undefined ? Number(satoshiBalance) : 20000,
      npi: npi || `10${Math.floor(10000000000 + Math.random() * 90000000000)}`,
      avatar: (name || normalizedEmail).substring(0, 2).toUpperCase()
    };

    saveDb();

    res.json(PATIENTS_DB[normalizedEmail]);
  });

  // 6. GET OR CREATE PATIENT PROFILE
  app.get("/api/wallet/patients/:email", requireAuth, requireRole('patient'), async (req, res) => {
    const { email } = req.params;
    const normalizedEmail = email.toLowerCase().trim();
    if (!(await ownsPatientEmail(Number((req as any).userId), normalizedEmail))) {
      return res.status(403).json({ error: 'Profil patient non autorisé.' });
    }

    if (!PATIENTS_DB[normalizedEmail]) {
      // Create virtual default patient profile if logging in for the first time
      PATIENTS_DB[normalizedEmail] = {
        name: normalizedEmail.split("@")[0].replace(".", " ").replace(/\b\w/g, c => c.toUpperCase()),
        email: normalizedEmail,
        phone: "+229 01 97 00 00 00",
        walletBalance: 10000,
        satoshiBalance: 20000,
        npi: `10${Math.floor(10000000000 + Math.random() * 90000000000)}`,
        avatar: normalizedEmail.substring(0, 2).toUpperCase()
      };
      saveDb();
    }
    res.json(PATIENTS_DB[normalizedEmail]);
  });

  // 6b. PATCH UPDATE PATIENT PROFILE (e.g. name, phone, health info etc.)
  app.patch("/api/wallet/patients/:email", requireAuth, requireRole('patient'), async (req, res) => {
    const { email } = req.params;
    const { name, phone, bloodGroup, recurringDiseases, antecedents, allergies, npi } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    if (!(await ownsPatientEmail(Number((req as any).userId), normalizedEmail))) {
      return res.status(403).json({ error: 'Profil patient non autorisé.' });
    }

    const patient = PATIENTS_DB[normalizedEmail];
    if (!patient) {
      return res.status(404).json({ error: "Citoyen non trouvé" });
    }

    if (name !== undefined) {
      patient.name = name;
      patient.avatar = name.substring(0, 2).toUpperCase();
    }
    if (phone !== undefined) {
      patient.phone = phone;
    }
    if (bloodGroup !== undefined) {
      patient.bloodGroup = bloodGroup;
    }
    if (recurringDiseases !== undefined) {
      patient.recurringDiseases = recurringDiseases;
    }
    if (antecedents !== undefined) {
      patient.antecedents = antecedents;
    }
    if (allergies !== undefined) {
      patient.allergies = allergies;
    }
    if (npi !== undefined) {
      patient.npi = npi;
    }

    saveDb();

    res.json(patient);
  });

  // 7. POST DEPOSIT (Izichange & Breez Lightning Network Integration)
  app.post("/api/wallet/patients/:email/deposit", requireAuth, requireRole('patient'), async (req, res) => {
    const authenticatedUserId = (req as any).userId;
    const { email } = req.params;
    const { amountXOF, operator, phoneNumber } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    let patient = PATIENTS_DB[normalizedEmail];
    if (process.env.NODE_ENV === 'production' && !dbService.getStatus().connected) {
      return res.status(503).json({ error: 'Payment database unavailable' });
    }
    if (!patient && process.env.NODE_ENV === 'production') {
      const owner = await dbService.query<any>(
        `SELECT u.email, u.phone FROM users u WHERE u.id = $1 AND LOWER(u.email) = LOWER($2) LIMIT 1`,
        [authenticatedUserId, normalizedEmail]
      );
      if (owner?.rows[0]) {
        patient = { email: owner.rows[0].email, phone: owner.rows[0].phone };
      }
    }
    if (!patient) {
      return res.status(404).json({ error: "Citoyen non trouvé" });
    }

    if (dbService.getStatus().connected) {
      const owner = await dbService.query<{ id: number }>(
        'SELECT id FROM users WHERE id = $1 AND LOWER(email) = LOWER($2) LIMIT 1',
        [authenticatedUserId, normalizedEmail]
      );
      if (!owner?.rows[0]) {
        return res.status(403).json({ error: 'Wallet does not belong to authenticated user' });
      }
    }

    if (!amountXOF || amountXOF <= 0) {
      return res.status(400).json({ error: "Montant de recharge invalide" });
    }

    const requestedAmount = Number(amountXOF);

    if (process.env.NODE_ENV === 'production') {
      try {
        const payment = await momoService.initializePayment({
          amount: requestedAmount,
          phone: phoneNumber || patient.phone,
          operator,
          patientEmail: normalizedEmail,
          description: 'Recharge portefeuille Santé+',
        });
        if (dbService.getStatus().connected) {
          await dbService.query(
            `INSERT INTO payment_transactions
             (payer_id, provider, provider_reference, amount_xof, status, metadata)
             VALUES ($1, $2, $3, $4, 'pending', $5::jsonb)
             ON CONFLICT (provider_reference) DO NOTHING`,
            [authenticatedUserId, payment.provider, payment.transactionId, requestedAmount, JSON.stringify({ reference: payment.reference, phone: payment.phone })]
          );
        }
        return res.status(202).json({
          ...patient,
          walletBalance: undefined,
          integration: payment.provider,
          transactionId: payment.transactionId,
          reference: payment.reference,
          status: payment.status.toLowerCase(),
          paymentUrl: payment.paymentUrl,
        });
      } catch (error: any) {
        return res.status(502).json({ error: error.message || 'Payment provider unavailable' });
      }
    }

    return res.status(503).json({ error: 'Use /api/payments/momo/initialize for provider-backed deposits.' });
  });

  // 7b. MOBILE MONEY BÉNIN INITIALIZE (MTN MoMo & Moov Flooz / FedaPay)
  app.post("/api/payments/momo/initialize", requireAuth, requireRole('patient'), async (req, res) => {
    try {
      const { amount, phone, operator, description, patientEmail } = req.body;
      if (!amount || !phone) {
        return res.status(400).json({ success: false, error: "Montant et numéro de téléphone requis" });
      }
      const authenticatedUserId = (req as any).userId;
      if (patientEmail && dbService.getStatus().connected) {
        const owner = await dbService.query(
          'SELECT 1 FROM users WHERE id = $1 AND LOWER(email) = LOWER($2) LIMIT 1',
          [authenticatedUserId, patientEmail]
        );
        if (!owner?.rows[0]) return res.status(403).json({ success: false, error: 'Wallet does not belong to authenticated user' });
      }

      const result = await momoService.initializePayment({
        amount: Number(amount),
        phone,
        operator,
        description,
        patientEmail
      });

      res.status(201).json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // 7c. MOBILE MONEY STATUS VERIFY
  app.get("/api/payments/momo/verify/:txId", requireAuth, requireRole('patient'), (req, res) => {
    const { txId } = req.params;
    const tx = momoService.getTransactionStatus(txId);
    if (!tx) {
      return res.status(404).json({ success: false, error: "Transaction Mobile Money introuvable" });
    }
    res.json({ success: true, data: tx });
  });

  // 7d. MOBILE MONEY WEBHOOK
  app.post("/api/payments/momo/webhook", async (req, res) => {
    const signature = req.headers['x-fedapay-signature'] || req.headers['x-webhook-signature'];
    const rawBody = (req as any).rawBody;
    const signatureValid = hasValidWebhookSignature(req.body, rawBody, signature, process.env.FEDAPAY_WEBHOOK_SECRET);
    if (!signatureValid) {
      await recordWebhookEvent('fedapay', req.body, rawBody, false, false, 'Invalid signature');
      return res.status(401).json({ success: false, error: 'Signature webhook invalide' });
    }
    const result = momoService.processWebhook(req.body);
    if (result.success && dbService.getStatus().connected) {
      const credited = await dbService.transaction(async client => {
        const transaction = await client.query<any>(
          `SELECT id, payer_id, amount_xof, status FROM payment_transactions
           WHERE provider_reference = $1 FOR UPDATE`,
          [result.transactionId]
        );
        const pending = transaction.rows[0];
        if (!pending || pending.status === 'confirmed') {
          return false;
        }

        const wallet = await client.query<any>(
          `UPDATE wallet_accounts SET balance_xof = balance_xof + $1, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $2 RETURNING id, balance_xof AS "balanceAfterXof"`,
          [pending.amount_xof, pending.payer_id]
        );
        if (!wallet.rows[0]) {
          throw new Error('Wallet account not found');
        }

        await client.query(
          `UPDATE payment_transactions SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [pending.id]
        );
        await client.query(
          `INSERT INTO wallet_transactions
           (wallet_id, payment_transaction_id, direction, amount_xof, balance_after_xof, reference)
           VALUES ($1, $2, 'credit', $3, $4, $5)
           ON CONFLICT (reference) DO NOTHING`,
          [wallet.rows[0].id, pending.id, pending.amount_xof, wallet.rows[0].balanceAfterXof, result.transactionId]
        );
        return true;
      });
      await recordWebhookEvent('fedapay', req.body, rawBody, true, credited === true, credited ? undefined : 'Already processed or unknown transaction');
      return res.json({ success: true, processed: result.success, credited });
    }
    await recordWebhookEvent('fedapay', req.body, rawBody, true, result.success, result.success ? undefined : 'Unknown transaction');
    res.json({ success: true, processed: result.success });
  });

  // 7e. CREATE LIGHTNING INVOICE (LNbits API or Sandbox)
  app.post("/api/payments/create-lightning-invoice", requireAuth, requireRole('patient'), async (req, res) => {
    const { amountXOF, description } = req.body;
    
    if (!amountXOF || amountXOF <= 0) {
      return res.status(400).json({ error: "Montant invalide" });
    }

    const amountSats = Math.round(Number(amountXOF) * XOF_TO_SATS);
    
    try {
      const lnResult = await lightningService.createInvoice(
        amountSats,
        Number(amountXOF),
        description || "Facture Santé+ Bénin"
      );

      LIGHTNING_INVOICES_DB[lnResult.invoiceId] = {
        id: lnResult.invoiceId,
        amountXOF: Number(amountXOF),
        amountSats,
        bolt11: lnResult.invoice,
        paymentHash: lnResult.paymentHash,
        isPaid: false,
        txHash: `ln_tx_0x${lnResult.paymentHash}`,
        provider: lnResult.provider,
        isLive: lnResult.isLive,
        createdAt: Date.now()
      };

      if (dbService.getStatus().connected) {
        await dbService.query(
          `INSERT INTO lightning_invoices
           (id, amount_xof, amount_sats, bolt11, payment_hash, provider, is_live)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [lnResult.invoiceId, Number(amountXOF), amountSats, lnResult.invoice, lnResult.paymentHash, lnResult.provider, lnResult.isLive]
        );
      } else if (process.env.NODE_ENV !== 'production') {
        saveDb();
      }

      res.json({
        invoice: lnResult.invoice,
        invoiceId: lnResult.invoiceId,
        paymentHash: lnResult.paymentHash,
        amountSats,
        isLive: lnResult.isLive,
        provider: lnResult.provider,
        status: lnResult.isLive ? "pending_lnbits_settlement" : "sandbox_pending"
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Erreur création invoice Lightning" });
    }
  });

  // 7c. VERIFY LIGHTNING INVOICE STATUS
  app.get("/api/payments/verify-lightning-invoice", requireAuth, requireRole('patient'), async (req, res) => {
    const { invoiceId } = req.query;
    
    if (!invoiceId) {
      return res.status(400).json({ error: "ID d'invoice manquant" });
    }

    let invoice = LIGHTNING_INVOICES_DB[String(invoiceId)];
    if (!invoice && dbService.getStatus().connected) {
      const result = await dbService.query<any>(
        `SELECT id, amount_xof AS "amountXOF", amount_sats AS "amountSats", bolt11,
                payment_hash AS "paymentHash", is_paid AS "isPaid", tx_hash AS "txHash",
                provider, is_live AS "isLive"
         FROM lightning_invoices WHERE id = $1 LIMIT 1`,
        [String(invoiceId)]
      );
      invoice = result?.rows[0];
    }
    if (!invoice) {
      return res.status(404).json({ error: "Invoice non trouvée" });
    }

    // Si pas encore payé et connecté à LNbits, vérifier directement auprès du nœud
    if (!invoice.isPaid && invoice.isLive && invoice.paymentHash) {
      const status = await lightningService.checkPaymentStatus(invoice.paymentHash);
      if (status.paid) {
        invoice.isPaid = true;
        if (status.preimage) {
          invoice.txHash = `ln_preimage_${status.preimage}`;
        }
      }
    }

    // Sync state with general INVOICES_DB once paid
    if (invoice.isPaid) {
      const matchInvoices = INVOICES_DB.filter(inv => inv.totalXOF === invoice.amountXOF && !inv.isPaid);
      if (matchInvoices.length > 0) {
        matchInvoices[0].isPaid = true;
        matchInvoices[0].paymentMethod = "Lightning";
        matchInvoices[0].txHash = invoice.txHash;
      }
    }

    if (dbService.getStatus().connected) {
      await dbService.query(
        `UPDATE lightning_invoices SET is_paid = $1, tx_hash = $2, paid_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE paid_at END WHERE id = $3`,
        [invoice.isPaid, invoice.txHash, invoice.id]
      );
    } else if (process.env.NODE_ENV !== 'production') {
      saveDb();
    }

    res.json({
      isPaid: invoice.isPaid,
      txHash: invoice.txHash,
      isLive: invoice.isLive || false,
      provider: invoice.provider || 'sandbox'
    });
  });

  // 7d. WEBHOOK LIGHTNING LNbits
  app.post("/api/payments/lightning-webhook", async (req, res) => {
    const signature = req.headers['x-lnbits-signature'] || req.headers['x-webhook-signature'];
    const rawBody = (req as any).rawBody;
    const signatureValid = hasValidWebhookSignature(req.body, rawBody, signature, process.env.LNBITS_WEBHOOK_SECRET);
    if (!signatureValid) {
      await recordWebhookEvent('lnbits', req.body, rawBody, false, false, 'Invalid signature');
      return res.status(401).json({ success: false, error: 'Signature webhook invalide' });
    }
    const { payment_hash, checking_id } = req.body;
    
    const invoice = Object.values(LIGHTNING_INVOICES_DB).find(
      (inv: any) => inv.paymentHash === payment_hash || inv.id === checking_id
    );

    if (invoice) {
      const wasAlreadyPaid = invoice.isPaid;
      invoice.isPaid = true;
      if (dbService.getStatus().connected && !wasAlreadyPaid) {
        await dbService.query(
          `UPDATE lightning_invoices SET is_paid = TRUE, tx_hash = $1, paid_at = CURRENT_TIMESTAMP
           WHERE payment_hash = $2 OR id = $3`,
          [`ln_webhook_${payment_hash || checking_id}`, payment_hash, checking_id]
        );
      }
      if (dbService.getStatus().connected) {
        await dbService.query(
          `UPDATE lightning_invoices SET is_paid = TRUE, tx_hash = $1, paid_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [`ln_webhook_${payment_hash || checking_id}`, invoice.id]
        );
      } else if (process.env.NODE_ENV !== 'production') {
        saveDb();
      }
      await recordWebhookEvent('lnbits', req.body, rawBody, true, true);
      return res.json({ success: true, alreadyProcessed: wasAlreadyPaid, message: "Paiement Lightning confirmé" });
    }

    await recordWebhookEvent('lnbits', req.body, rawBody, true, false, 'Unknown invoice');
    res.json({ received: true });
  });

  // 8. GET INVOICES / MEDICAL PAPERS
  app.get("/api/invoices", requireAuth, requireRole('patient', 'doctor', 'admin'), async (req, res) => {
    if ((req as any).userRole === 'patient') {
      const userResult = await dbService.query<{ email: string }>(
        'SELECT email FROM users WHERE id = $1 LIMIT 1', [(req as any).userId]
      );
      const email = userResult?.rows[0]?.email?.toLowerCase();
      return res.json(INVOICES_DB.filter(invoice => invoice.patientEmail?.toLowerCase() === email));
    }
    res.json(INVOICES_DB);
  });

  // 9. POST EMIT INVOICE (Hospital Dashboard)
  app.post("/api/invoices", requireAuth, requireRole('doctor', 'admin'), (req, res) => {
    const { patientName, patientPhone, hospitalName, hospitalAddress, items, totalXOF, paymentMethod, doctorName, isPaid } = req.body;

    const invoiceId = `FACT-${Math.floor(100000 + Math.random() * 900000)}`;
    const txHash = `tx_benin_0x${Array.from({length: 40}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')}`;

    const newInvoice = {
      id: invoiceId,
      patientName,
      patientPhone: patientPhone || "+229 01 97 88 55 44",
      hospitalName,
      hospitalAddress,
      date: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}),
      items: items || [],
      totalXOF: Number(totalXOF) || 0,
      totalSats: Math.round((Number(totalXOF) || 0) * XOF_TO_SATS),
      paymentMethod: paymentMethod || 'Wallet',
      txHash,
      isPaid: !!isPaid,
      doctorName: doctorName || "Dr. Sossou"
    };

    INVOICES_DB.push(newInvoice);
    saveDb();
    publishRealtimeEvent({ type: 'created', entity: 'invoice', entityId: newInvoice.id });
    res.status(201).json(newInvoice);
  });

  // 10. PAY INVOICE (WALLET DEBIT)
  app.post("/api/invoices/:id/pay", requireAuth, requireRole('patient'), async (req, res) => {
    const { id } = req.params;

    const invoice = INVOICES_DB.find(inv => inv.id === id);
    if (!invoice) {
      return res.status(404).json({ error: "Facture non trouvée" });
    }
    if (!(await ownsPatientEmail(Number((req as any).userId), invoice.patientEmail || ''))) {
      return res.status(403).json({ error: 'Cette facture ne vous appartient pas.' });
    }
    const normalizedEmail = invoice.patientEmail.toLowerCase().trim();

    if (invoice.isPaid) {
      const patient = PATIENTS_DB[normalizedEmail];
      return res.json({ invoice, patient });
    }

    const patient = PATIENTS_DB[normalizedEmail];
    if (!patient) {
      return res.status(404).json({ error: "Patient non trouvé" });
    }

    if (patient.walletBalance < invoice.totalXOF) {
      return res.status(400).json({ error: `Solde insuffisant dans votre portefeuille Santé+ (${patient.walletBalance} XOF dispos vs ${invoice.totalXOF} XOF requis)` });
    }

    // Debit and mark paid
    patient.walletBalance -= invoice.totalXOF;
    invoice.isPaid = true;
    invoice.paymentMethod = "Wallet";
    invoice.txHash = `tx_wallet_0x${Array.from({length: 40}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')}`;

    saveDb();
    publishRealtimeEvent({ type: 'updated', entity: 'invoice', entityId: id });

    res.json({ invoice, patient });
  });

  // 11. PAY INVOICE (LIGHTNING BITCOIN)
  app.post("/api/invoices/:id/pay-lightning", requireAuth, requireRole('patient'), async (req, res) => {
    const { id } = req.params;

    const invoice = INVOICES_DB.find(inv => inv.id === id);
    if (!invoice) {
      return res.status(404).json({ error: "Facture non trouvée" });
    }
    if (!(await ownsPatientEmail(Number((req as any).userId), invoice.patientEmail || ''))) {
      return res.status(403).json({ error: 'Cette facture ne vous appartient pas.' });
    }
    const normalizedEmail = invoice.patientEmail.toLowerCase().trim();

    if (invoice.isPaid) {
      const patient = normalizedEmail ? PATIENTS_DB[normalizedEmail] : null;
      return res.json({ invoice, patient });
    }

    let patient = null;
    if (normalizedEmail && PATIENTS_DB[normalizedEmail]) {
      patient = PATIENTS_DB[normalizedEmail];
      const balance = patient.satoshiBalance !== undefined ? patient.satoshiBalance : 20000;
      if (balance < invoice.totalSats) {
        return res.status(400).json({ error: `Solde Satoshi insuffisant dans votre portefeuille Lightning (${balance} Sats dispos vs ${invoice.totalSats} Sats requis).` });
      }
      patient.satoshiBalance = balance - invoice.totalSats;
    }

    invoice.isPaid = true;
    invoice.paymentMethod = "Lightning";
    invoice.txHash = `ln_tx_0x${Array.from({length: 40}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')}`;

    saveDb();

    if (patient) {
      res.json({ invoice, patient });
    } else {
      res.json({ invoice });
    }
  });

  // 12. GET ACCESS REQUESTS
  app.get("/api/access-requests", (req, res) => {
    res.json(ACCESS_REQUESTS_DB);
  });

  // 13. POST ACCESS REQUEST
  app.post("/api/access-requests", (req, res) => {
    const { npi, doctorEmail, hospitalName } = req.body;

    const newRequest = {
      id: `req-${Math.floor(100 + Math.random() * 900)}`,
      npi,
      doctorEmail,
      hospitalName,
      status: 'pending',
      requestedAt: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})
    };

    ACCESS_REQUESTS_DB.push(newRequest);
    saveDb();
    res.status(201).json(newRequest);
  });

  // 14. PATCH ACCESS REQUEST STATUS
  app.patch("/api/access-requests/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const request = ACCESS_REQUESTS_DB.find(req => req.id === id);
    if (!request) {
      return res.status(404).json({ error: "Demande d'accès introuvable" });
    }

    request.status = status;
    saveDb();
    res.json(request);
  });

  // 15. AI CHATBOT (GEMINI OR EMBEDDED PROCEDURAL RULES)
  app.post("/api/chat", requireAuth, loginRateLimit, async (req, res) => {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Le message est requis." });
    }

    // Try Gemini if API Key is configured
    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const systemInstruction = `
          Tu es "L'Assistant d'Orientation et de Triage de Santé+ Bénin", un chatbot médical et administratif de premier contact.
          
          Règles absolues à respecter concernant l'IA et le GPS :
          1. TON RÔLE UNIQUE EN CAS DE SYMPTÔMES : Faire du triage d'orientation intelligent. Tu ne dois JAMAIS poser de diagnostic médical.
          2. FORMAT DE RÉPONSE OBLIGATOIRE EN CAS DE DESCRIPTION DE SYMPTÔME OU MALADIE (à structurer clairement avec des tirets ou puces) :
             - Symptôme identifié : [Les symptômes rapportés par l'utilisateur]
             - Spécialité recommandée : [La spécialité médicale adaptée, ex: Pédiatrie, Gynécologie, Ophtalmologie, Cardiologie, Médecine Générale...]
             - Hôpital recommandé : [Proposer un hôpital ou clinique publique/privée du Bénin proche de Cotonou, Abomey-Calavi, Porto-Novo, Parakou, CHD, CNHU-HKM...]
             - Prix moyen estimé : [Estimation de la consultation de base, ex: 3 000 XOF ou 5 000 XOF]
             - Notes / Recommandations d'orientation : [Consignes simples, rappel d'absence de diagnostic et encouragement à consulter de manière formelle. Rappeler que Santé+ ne géolocalise JAMAIS le patient en tâche de fond pour préserver sa vie privée.]
          3. SOUVERAINETÉ ET VIE PRIVÉE : Tu ne tracks jamais la position GPS de l'utilisateur. Tu suggères simplement des établissements d'après les communes béninoises mentionnées.
          4. Les rendez-vous médicaux : Le choix du Service médical et de la Cause (motif) est obligatoire. Le choix du Docteur/Médecin est facultatif (optionnel).
          5. Les factures : Les factures payées comportent un tampon officiel rouge "PAYÉ & CERTIFIÉ" du Ministère de la Santé du Bénin. La vérification se fait exclusivement offline par scan de QR code (qui contient les données décentralisées cryptées ou en clair de mobile à mobile). Aucune donnée médicale n'est hébergée ou publiée en ligne.
          6. Autorisation de dossier par le patient : Le patient n'a pas besoin de reconnaissance faciale ou d'empreinte digitale. Il signe l'autorisation de consultation via un bouton sécurisé avec son identité Lightning Network (LN Sign - signature cryptographique décentralisée Bitcoin) de façon claire et visible.
          7. Le paiement se fait par Portefeuille local (Sandbox FCFA) ou par Lightning Network (Satoshis / Bitcoin) instantanément sans intermédiaire.
          
          REGLE DE STYLE CRITIQUE : Évite d'utiliser trop d'astérisques (**) pour le formatage en gras. N'en utilise presque pas. Tu peux mettre certains mots clés importants en MAJUSCULES (comme PAYÉ, OPTIONNEL, GRATUIT) mais n'abuse pas des symboles ou des étoiles pour que le chat reste très propre et facile à lire.
          
          Reste humble, poli et concis. Ne simule pas d'expertise clinique définitive.
        `;

        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            { role: "user", parts: [{ text: `Instruction système: ${systemInstruction}` }] },
            ...(history || []).map((h: any) => ({
              role: h.role === "user" ? "user" : "model",
              parts: [{ text: h.text }]
            })),
            { role: "user", parts: [{ text: message }] }
          ]
        });

        const reply = response.text || "Désolé, je n'ai pas pu générer de réponse.";
        return res.json({ text: reply, source: "gemini" });
      } catch (err: any) {
        console.error("Gemini API Error, falling back to local chat engine:", err);
      }
    }

    // Fallback: Local rule-based intelligent chatbot for offline/fallback mode
    const msg = message.toLowerCase();
    let reply = "";

    // Symptom / Triage request detection
    if (msg.includes("sympt") || msg.includes("mal") || msg.includes("douleur") || msg.includes("fièvre") || msg.includes("tête") || msg.includes("ventre") || msg.includes("toux") || msg.includes("grippe") || msg.includes("fatigue") || msg.includes("vomir")) {
      reply = `[Triage & Orientation Santé+]
Voici une proposition d'orientation basée sur vos symptômes (Attention, ceci n'est pas un diagnostic médical) :

• Symptôme identifié : Symptômes généraux décrits (Douleurs / Fièvre / Inconfort)
• Spécialité recommandée : Médecine Générale / Urgences (selon intensité)
• Hôpital recommandé : CNHU-HKM (Cotonou) ou Hôpital de Zone d'Abomey-Calavi
• Prix moyen estimé : 3 000 XOF - 5 000 XOF pour la consultation
• Notes et Recommandations : Reposez-vous, hydratez-vous et prenez rendez-vous sur Santé+ pour obtenir une consultation professionnelle. Pour des raisons de protection de votre vie privée, Santé+ ne géolocalise jamais votre smartphone.`;
    } else if (msg.includes("facture") || msg.includes("payer") || msg.includes("recharge") || msg.includes("solde") || msg.includes("argent")) {
      reply = "Sur Santé+ Bénin, vos factures de soins sont réglées en FCFA (via le solde de votre portefeuille) ou en Satoshis via le Réseau Lightning (Bitcoin) sans intermédiaire. Une fois payée, la facture reçoit immédiatement un tampon rouge officiel PAYÉ & CERTIFIÉ du Ministère de la Santé du Bénin et affiche un QR Code de preuve. Ce QR Code permet une vérification 100% hors-ligne (offline) par scan de vos papiers officiels.";
    } else if (msg.includes("rendez") || msg.includes("rdv") || msg.includes("docteur") || msg.includes("médecin") || msg.includes("service")) {
      reply = "Pour prendre rendez-vous chez Santé+ : vous devez obligatoirement sélectionner le Service médical ainsi que la Cause ou Raison de votre visite. Le choix d'un Docteur spécifique est quant à lui optionnel (vous pouvez le laisser vide si vous n'avez pas de préférence et l'établissement vous affectera le praticien disponible).";
    } else if (msg.includes("autorisation") || msg.includes("signer") || msg.includes("blockchain") || msg.includes("dossier") || msg.includes("lightning") || msg.includes("empreinte") || msg.includes("visage") || msg.includes("ident") || msg.includes("bitcoin")) {
      reply = "La sécurité de Santé+ est décentralisée et respecte votre vie privée. Vous n'avez aucun besoin de reconnaissance faciale ou d'empreinte digitale. À la place, un bouton clair vous permet de signer vos autorisations de dossier médical à l'aide de votre clé privée du Réseau Lightning (LN Sign). C'est instantané, visible, inviolable et enregistré via hash d'intégrité sur la blockchain Bitcoin (notaire décentralisé).";
    } else if (msg.includes("scan") || msg.includes("papier") || msg.includes("vérification") || msg.includes("hors ligne") || msg.includes("offline")) {
      reply = "La vérification des papiers et dossiers médicaux est conçue pour fonctionner uniquement par scan hors ligne. Les informations du patient sont stockées localement de manière sécurisée et ne sont jamais hébergées en ligne sur internet pour garantir une confidentialité totale.";
    } else if (msg.includes("bonjour") || msg.includes("salut") || msg.includes("hello")) {
      reply = "Bonjour ! Je suis l'Assistant Virtuel de Santé+ Bénin. Comment puis-je vous aider aujourd'hui ? Vous pouvez me décrire vos symptômes pour un triage intelligent, ou me poser des questions sur les factures, les rendez-vous, la signature Lightning Network ou la vérification offline par scan !";
    } else {
      reply = "Je suis l'Assistant d'Orientation et de Triage de Santé+ Bénin. Je peux vous orienter d'après vos symptômes :\n\n- Triage Symptômes : Décrivez vos symptômes pour obtenir une orientation (Symptôme -> Spécialité -> Hôpital + Prix + Notes).\n- Factures : Tampon PAYÉ officiel, QR Code offline.\n- Rendez-vous : Service et motif requis, docteur optionnel.\n- Sécurité : Signature cryptographique Lightning (LN Sign), sans biométrie.\n- Scan : Vérification des papiers 100% hors-ligne.\n\nQue souhaitez-vous savoir en particulier ?";
    }

    res.json({ text: reply, source: "local" });
  });

  // 15b. AI CHATBOT STREAMING — Server-Sent Events (SSE) pour Gemini temps réel
  app.get("/api/chat/stream", requireAuth, loginRateLimit, async (req, res) => {
    const message = String(req.query.message || "");
    const historyParam = String(req.query.history || "[]");
    
    if (!message.trim()) {
      return res.status(400).json({ error: "Le message est requis." });
    }

    // SSE Headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    const sendEvent = (data: object) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        let history: Array<{ role: string; text: string }> = [];
        try { history = JSON.parse(historyParam); } catch { /* ignore */ }

        const systemInstruction = `Tu es "L'Assistant d'Orientation et de Triage de Santé+ Bénin", un chatbot médical béninois bienveillant. Tu fais du triage d'orientation mais tu ne poses JAMAIS de diagnostic médical. En cas de symptômes, structure ta réponse: Symptôme identifié, Spécialité recommandée, Hôpital béninois recommandé, Prix moyen estimé, Notes d'orientation. Reste concis, évite les astérisques excessifs. Mets en MAJUSCULES les mots clés importants.`;

        const response = await ai.models.generateContentStream({
          model: "gemini-2.0-flash",
          contents: [
            { role: "user", parts: [{ text: `Instruction système: ${systemInstruction}` }] },
            ...history.map((h) => ({
              role: h.role === "user" ? "user" : "model",
              parts: [{ text: h.text }],
            })),
            { role: "user", parts: [{ text: message }] },
          ],
        });

        for await (const chunk of response) {
          const text = chunk.text;
          if (text) sendEvent({ chunk: text, done: false });
        }

        sendEvent({ done: true, source: "gemini" });
        return res.end();
      } catch (err: any) {
        console.error("[Gemini Streaming Error]:", err.message);
        sendEvent({ error: true, message: "Erreur Gemini, bascule en mode local." });
      }
    }

    // Fallback local (mode hors-ligne)
    const msg = message.toLowerCase();
    let localReply = "";
    if (msg.includes("sympt") || msg.includes("mal") || msg.includes("douleur") || msg.includes("fièvre")) {
      localReply = "Triage Santé+ : Symptômes détectés → Spécialité : Médecine Générale → Hôpital recommandé : CNHU-HKM Cotonou ou Hôpital de Zone Abomey-Calavi → Prix estimé : 3 000 - 5 000 XOF. Ce n'est pas un diagnostic médical.";
    } else if (msg.includes("bonjour") || msg.includes("salut")) {
      localReply = "Bonjour ! Je suis l'Assistant Santé+ Bénin. Décrivez vos symptômes ou posez une question sur vos soins, rendez-vous ou factures.";
    } else {
      localReply = "Je suis l'Assistant Santé+ Bénin. Je peux vous orienter selon vos symptômes, vous informer sur vos rendez-vous, vos factures, ou la sécurité de votre dossier médical.";
    }

    // Simulate word-by-word streaming for local fallback
    const words = localReply.split(" ");
    for (const word of words) {
      sendEvent({ chunk: word + " ", done: false });
      await new Promise(r => setTimeout(r, 30));
    }
    sendEvent({ done: true, source: "local" });
    res.end();
  });


  // Integrated Vite Dev Mode Middleware / Production Asset Delivery
  if (process.env.NODE_ENV !== "production") {
    // Port dynamique pour HMR afin d'éviter tout conflit de WebSocket si une instance existe déjà
    const randomHmrPort = 24680 + Math.floor(Math.random() * 100);
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: {
          port: randomHmrPort
        }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const httpServer = createHttpServer(app);
  const websocketServer = new WebSocketServer({ server: httpServer, path: '/api/ws' });
  websocketServer.on('connection', (socket, request) => {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const token = requestUrl.searchParams.get('token') || request.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('sante_access_token='))?.split('=').slice(1).join('=');
    if (!token) {
      socket.close(1008, 'Authentication required');
      return;
    }

    let audienceUserId: number | undefined;
    try {
      const decoded: any = jwt.verify(token, authConfig.accessSecret);
      audienceUserId = Number(decoded.id);
    } catch {
      socket.close(1008, 'Invalid token');
      return;
    }

    socket.send(JSON.stringify({ type: 'connected', entity: 'realtime', timestamp: new Date().toISOString() }));
    const unsubscribe = subscribeRealtime(event => {
      if (event.audienceUserIds?.length && audienceUserId && !event.audienceUserIds.includes(audienceUserId)) return;
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
    });
    socket.on('close', unsubscribe);
    socket.on('error', unsubscribe);
  });

  httpServer.listen(resolvedPort, "0.0.0.0", () => {
    console.log(`[Santé+ Benin Server] running on http://0.0.0.0:${resolvedPort}`);
  });
}

if (process.env.VITEST !== "true") {
  startServer();
}
