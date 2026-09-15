// ============================================================================
// TYPES GLOBAUX - SANTÉ+
// ============================================================================

// ============================================================================
// UTILISATEURS
// ============================================================================

export enum UserRole {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

export interface User {
  id: number;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest {
  email?: string;
  phone?: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  expiresIn: number;
}

// ============================================================================
// PATIENTS
// ============================================================================

export enum BloodType {
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-',
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-'
}

export enum DonorStatus {
  NON_DONNEUR = 'non_donneur',
  DONNEUR_ACTIF = 'donneur_actif',
  DONNEUR_SUSPENDU = 'donneur_suspendu'
}

export interface Patient extends User {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender: 'M' | 'F';
  npi: string; // Numéro d'Identification Patient
  bloodType?: BloodType;
  allergies?: string[];
  chronicDiseases?: string[];
  bloodDonorStatus: DonorStatus;
  qrCodeHash: string;
  pin: string;
  emergencyContacts?: EmergencyContact[];
  avatarUrl?: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

// ============================================================================
// MÉDECINS
// ============================================================================

export interface Doctor extends User {
  firstName: string;
  lastName: string;
  specialty: string;
  licenseNumber: string;
  npi: string;
  hospitalId?: number;
  isActive: boolean;
  consultationFee: number; // en XOF
  rating: number; // 0-5
  ratingCount: number;
}

// ============================================================================
// HÔPITAUX
// ============================================================================

export enum HospitalType {
  PUBLIC = 'public',
  PRIVATE = 'private',
  CLINIC = 'clinic'
}

export interface Hospital {
  id: number;
  name: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  type: HospitalType;
  phone?: string;
  email?: string;
  website?: string;
  specialties: string[];
  equipment: string[];
  capacity?: number;
  isoaId?: string;
  averageRating: number;
  ratingCount: number;
  hasEmergency: boolean;
  hasBloodBank: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Price {
  name: string;
  priceXOF: number;
  priceSats?: number;
}

export interface HospitalDetails extends Hospital {
  priceList: Price[];
}

// ============================================================================
// CONSULTATIONS
// ============================================================================

export enum ConsultationStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface VitalSigns {
  weight?: number; // kg
  height?: number; // cm
  bloodPressure?: string; // 120/80
  pulse?: number; // bpm
  temperature?: number; // °C
  imc?: number;
}

export interface Consultation {
  id: number;
  patientId: number;
  doctorId: number;
  hospitalId: number;
  consultationDate: Date;
  motive: string;
  anamnesis?: string;
  clinicalExam?: string;
  vitalSigns?: VitalSigns;
  diagnosis: string;
  treatment?: string;
  recommendations?: string;
  workLeaveStart?: Date;
  workLeaveEnd?: Date;
  nextAppointment?: Date;
  status: ConsultationStatus;
  recordHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// PRESCRIPTIONS
// ============================================================================

export interface Prescription {
  id: number;
  consultationId: number;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity?: number;
  instructions?: string;
  isActive: boolean;
  recordHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// IMAGES MÉDICALES
// ============================================================================

export enum ImageType {
  RADIOGRAPHIE = 'radiographie',
  ECHOGRAPHIE = 'echographie',
  IRM = 'irm',
  SCANNER = 'scanner',
  PHOTO = 'photo'
}

export interface MedicalImage {
  id: number;
  patientId: number;
  consultationId?: number;
  imageType: ImageType;
  ipfsCid: string;
  description?: string;
  recordHash?: string;
  createdAt: Date;
}

// ============================================================================
// DOSSIERS MÉDICAUX
// ============================================================================

export interface MedicalRecord {
  id: number;
  patientId: number;
  recordHash: string;
  ipfsCid: string;
  bitcoinTxId?: string;
  merkleRoot?: string;
  recordType: 'consultation' | 'prescription' | 'analysis' | 'imaging';
  version: number;
  recordSize?: number;
  encryptedKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientDossier {
  id: string;
  patientId: string;
  generalInfo: {
    bloodType?: BloodType;
    allergies: string[];
    chronicDiseases: string[];
    weight?: number;
    height?: number;
    imc?: number;
  };
  medications: Prescription[];
  consultations: Consultation[];
  images: MedicalImage[];
  surgeries?: Surgery[];
  bloodDonations?: BloodDonation[];
  vaccinations?: Vaccination[];
  hashSignature?: string;
  asicId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Surgery {
  name: string;
  hospital: string;
  date: Date;
  surgeon: string;
  complications?: string;
}

export interface Vaccination {
  vaccineName: string;
  doseNumber: number;
  administrationDate: Date;
  batchNumber?: string;
}

// ============================================================================
// CONSENTEMENTS
// ============================================================================

export enum ConsentStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  REVOKED = 'revoked'
}

export interface PatientConsent {
  id: number;
  patientId: number;
  doctorId: number;
  hospitalId: number;
  startDate: Date;
  durationHours: number; // 24 ou 72
  endDate: Date;
  status: ConsentStatus;
  blockchainTxId?: string;
  revokedAt?: Date;
  createdAt: Date;
}

// ============================================================================
// PAIEMENTS & FACTURES
// ============================================================================

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export enum PaymentMethod {
  LIGHTNING = 'lightning',
  MOBILE_MONEY = 'mobile_money',
  CARD = 'card',
  WALLET = 'wallet'
}

export interface Invoice {
  id: string;
  patientId: number;
  doctorId?: number;
  hospitalId: number;
  consultationId?: number;
  items: InvoiceItem[];
  totalXof: number;
  totalSats?: number;
  hash: string;
  bitcoinTxId?: string;
  qrCode?: string;
  status: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paymentHash?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  priceXof: number;
  priceSats?: number;
}

export interface Payment {
  id: number;
  invoiceId: string;
  patientId: number;
  amountXof: number;
  amountSats?: number;
  method: PaymentMethod;
  reference?: string;
  status: PaymentStatus;
  transactionHash?: string;
  completedAt?: Date;
  createdAt: Date;
}

// ============================================================================
// DONS DE SANG
// ============================================================================

export enum DonationStatus {
  COMPLETED = 'completed',
  SCHEDULED = 'scheduled',
  CANCELLED = 'cancelled'
}

export interface BloodDonation {
  id: number;
  patientId: number;
  donationDate: Date;
  bloodType: BloodType;
  quantityMl: number;
  hospitalId: number;
  collectedBy?: number;
  status: DonationStatus;
  blockchainHash?: string;
  createdAt: Date;
}

// ============================================================================
// AUDIT & NOTIFICATIONS
// ============================================================================

export interface AuditLog {
  id: number;
  userId: number;
  action: string;
  targetType?: string;
  targetId?: number;
  details?: Record<string, any>;
  blockchainTxId?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export enum NotificationType {
  APPOINTMENT = 'appointment',
  PAYMENT = 'payment',
  CONSENT = 'consent',
  BLOOD = 'blood',
  REMINDER = 'reminder'
}

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  content: string;
  read: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ============================================================================
// BLOCKCHAIN
// ============================================================================

export interface BlockchainAnchor {
  hash: string;
  txid?: string;
  bitcoinAddress?: string;
  timestamp: string;
  status: 'pending' | 'confirmed' | 'failed';
  documentId: string;
}

export interface MerkleTree {
  root: string;
  leaves: string[];
  tree: string[][];
}

// ============================================================================
// GEOLOCALISATION
// ============================================================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface NearbyHospital extends Hospital {
  distance: number; // en km
  distanceText: string; // "1.2 km"
}
