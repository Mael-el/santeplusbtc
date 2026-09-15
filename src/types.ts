export interface Review {
  id: string;
  author: string;
  rating: number;
  date: string;
  comment: string;
}

export interface ServicePrice {
  name: string;
  priceXOF: number;
  priceSats: number;
  quantityAvailable?: number;
}

export interface Hospital {
  id: string;
  name: string;
  type: 'public' | 'private' | 'clinic' | 'lab';
  image: string;
  rating: number;
  reviewsCount: number;
  distance: string;
  address: string;
  phone: string;
  hours: string;
  isVerified: boolean;
  adminEmail?: string;
  services: string[];
  priceList: ServicePrice[];
  reviews: Review[];
  coords: { x: number; y: number };
  lat?: number;
  lng?: number;
}

export interface MedicalDocument {
  id: string;
  title: string;
  type: 'analyses' | 'prescription' | 'devis';
  items: { name: string; quantity?: number; priceXOF: number }[];
  priceXOF: number;
  priceSats: number;
  notes?: string;
  patientNpi?: string;
  hospitalId?: string;
  hospitalName?: string;
  doctorName?: string;
  doctorEmail?: string;
  date?: string;
  history?: { modifiedAt: string; modifiedBy: string; changes: string }[];
}

export interface Appointment {
  id: string;
  hospitalId: string;
  hospitalName: string;
  date: string;
  timeSlot: string;
  patientName: string;
  patientEmail?: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  service?: string;
  reason?: string;
  doctorName?: string;
  isPaid?: boolean;
  paymentMethod?: 'Wallet' | 'Lightning' | 'Credit' | 'Free';
  amountPaidXOF?: number;
  amountPaidSats?: number;
  cancellationReason?: string;
  creditAvailable?: boolean;
  creditUsedBy?: string;
  createdAt?: string;
}

export type PaymentMethod = 'wallet' | 'mtn' | 'moov' | 'celtiis' | 'lightning';
export type RechargeStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type InvoiceStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface WalletRecharge {
  id: string;
  patientId: number;
  amountXof: number;
  amountSats?: number;
  method: 'mobile_money' | 'lightning';
  provider: string;
  status: RechargeStatus;
  transactionId?: string;
  paymentHash?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Invoice {
  id: string;
  patientName: string;
  patientPhone?: string;
  patientEmail?: string;
  documentId?: string;
  appointmentId?: string;
  hospitalName: string;
  hospitalAddress?: string;
  date: string;
  items: { name: string; priceXOF: number }[];
  totalXOF: number;
  totalSats: number;
  paymentMethod: 'Wallet' | 'Lightning' | 'FamilyHelp' | string;
  txHash: string;
  isPaid: boolean;
  doctorName?: string;
  doctorPhone?: string;
  paymentQrCode?: string;
  contentHash?: string;
  notes?: string;
  status?: InvoiceStatus;
  paymentHash?: string;
  paidAt?: string;
}

export interface Patient {
  name: string;
  email?: string;
  phone: string;
  walletBalance: number;
  satoshiBalance?: number;
  npi?: string;
  qrCodeHash?: string;
  avatar?: string;
  bloodGroup?: string;
  recurringDiseases?: string;
  antecedents?: string;
  allergies?: string;
  dateOfBirth?: string;
  gender?: string;
  emergencyContacts?: Array<{ name: string; phone: string }>;
}

export interface HospitalUser {
  email: string;
  hospitalId: string;
  role: 'doctor' | 'admin' | 'nurse' | 'superadmin';
  name?: string;
  token?: string;
}

export interface AccessRequest {
  id: string;
  npi: string;
  doctorEmail: string;
  hospitalName: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  confirmedAt?: string;
  blockchainTxHash?: string;
}

export interface SpecialtyDepartment {
  id: string;
  name: string;
  description: string;
  doctorsCount: number;
  patientsCount: number;
  icon: string;
  status: 'active' | 'inactive';
}

export interface MedicalEquipment {
  id: string;
  name: string;
  unitsCount: number;
  status: 'available' | 'maintenance';
  scheduledMaintenance?: string;
  returnDate?: string;
  icon: string;
}

export interface AdminPatientRecord {
  id: string;
  name: string;
  initials: string;
  age: number;
  consultsCount: number;
  bloodGroup: string;
  hasAlert?: boolean;
  isDonor?: boolean;
  status: 'active' | 'new' | 'urgent';
  phone?: string;
  npi?: string;
}

export type AppView = 
  | 'landing' 
  | 'map' 
  | 'hospital-details' 
  | 'payment-flow' 
  | 'wallet' 
  | 'appointments' 
  | 'auth' 
  | 'hospital-dashboard'
  | 'director-admin'
  | 'platform-owner'
  | 'dossier'
  | 'blood'
  | 'faq';
