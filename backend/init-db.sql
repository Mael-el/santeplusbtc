-- ============================================================================
-- INITIALISATION BASE DE DONNÉES POSTGRESQL - SANTÉ+
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- TABLES UTILISATEURS
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'patient',
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- Registre d'identité séparé : aucune donnée médicale n'est stockée ici.
CREATE TABLE IF NOT EXISTS identity_registry (
    identity_uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(30) NOT NULL,
    npi VARCHAR(32) NOT NULL,
    qr_code_hash VARCHAR(128),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT identity_registry_role_check CHECK (role IN ('patient', 'doctor', 'admin')),
    CONSTRAINT identity_registry_npi_unique UNIQUE (npi),
    CONSTRAINT identity_registry_email_unique UNIQUE (email),
    CONSTRAINT identity_registry_phone_unique UNIQUE (phone),
    CONSTRAINT identity_registry_qr_unique UNIQUE (qr_code_hash)
);

CREATE INDEX IF NOT EXISTS idx_identity_registry_lookup_npi ON identity_registry(npi);
CREATE INDEX IF NOT EXISTS idx_identity_registry_lookup_phone ON identity_registry(phone);
CREATE INDEX IF NOT EXISTS idx_identity_registry_lookup_qr ON identity_registry(qr_code_hash);
ALTER TABLE identity_registry ALTER COLUMN email DROP NOT NULL;

-- ============================================================================
-- TABLE PATIENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    identity_uuid UUID UNIQUE REFERENCES identity_registry(identity_uuid) ON DELETE RESTRICT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    npi VARCHAR(13) UNIQUE NOT NULL,
    blood_type VARCHAR(5),
    allergies TEXT,
    emergency_contacts JSONB DEFAULT '[]'::jsonb,
    chronic_diseases TEXT,
    blood_donor_status VARCHAR(50) DEFAULT 'non_donneur',
    qr_code_hash VARCHAR(64) UNIQUE NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patients_npi ON patients(npi);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS identity_uuid UUID UNIQUE REFERENCES identity_registry(identity_uuid) ON DELETE RESTRICT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contacts JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_patients_identity_uuid ON patients(identity_uuid);

-- Migration des patients existants vers le registre d'identité pseudonymisé.
INSERT INTO identity_registry (user_id, role, email, phone, npi, qr_code_hash)
SELECT u.id, 'patient', u.email, u.phone, p.npi, p.qr_code_hash
FROM users u
JOIN patients p ON p.user_id = u.id
WHERE u.role = 'patient'
ON CONFLICT (user_id) DO NOTHING;

UPDATE patients p
SET identity_uuid = ir.identity_uuid
FROM identity_registry ir
WHERE ir.user_id = p.user_id AND p.identity_uuid IS NULL;
CREATE INDEX IF NOT EXISTS idx_patients_blood_type ON patients(blood_type);

ALTER TABLE patients ALTER COLUMN gender TYPE VARCHAR(20);

-- ============================================================================
-- TABLE DOCTORS
-- ============================================================================

CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    specialty VARCHAR(100) NOT NULL,
    license_number VARCHAR(50) UNIQUE NOT NULL,
    npi VARCHAR(13) UNIQUE NOT NULL,
    hospital_id INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    consultation_fee INTEGER DEFAULT 5000,
    rating DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doctors_user_id ON doctors(user_id);
CREATE INDEX IF NOT EXISTS idx_doctors_specialty ON doctors(specialty);

-- ============================================================================
-- TABLE HOSPITALS
-- ============================================================================

CREATE TABLE IF NOT EXISTS hospitals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) DEFAULT 'Benin',
    latitude DECIMAL(10,8),
    longitude DECIMAL(10,8),
    type VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(255),
    specialties TEXT[],
    equipment TEXT[],
    capacity INTEGER,
    iaso_id VARCHAR(100) UNIQUE,
    average_rating DECIMAL(3,2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    has_emergency BOOLEAN DEFAULT FALSE,
    has_blood_bank BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals(city);
CREATE INDEX IF NOT EXISTS idx_hospitals_type ON hospitals(type);
CREATE INDEX IF NOT EXISTS idx_hospitals_coords ON hospitals(latitude, longitude);

-- ============================================================================
-- TABLE CONSULTATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS consultations (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id),
    doctor_id INTEGER REFERENCES doctors(id),
    hospital_id INTEGER REFERENCES hospitals(id),
    consultation_date TIMESTAMP NOT NULL,
    motive TEXT NOT NULL,
    anamnesis TEXT,
    clinical_exam TEXT,
    vital_signs JSONB,
    diagnosis TEXT NOT NULL,
    treatment TEXT,
    recommendations TEXT,
    work_leave_start DATE,
    work_leave_end DATE,
    next_appointment TIMESTAMP,
    status VARCHAR(20) DEFAULT 'completed',
    record_hash VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_doctor_id ON consultations(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultations_date ON consultations(consultation_date);

-- ============================================================================
-- TABLE RENDEZ-VOUS
-- ============================================================================

CREATE TABLE IF NOT EXISTS appointments (
    id VARCHAR(50) PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
    doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
    hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMP NOT NULL,
    service VARCHAR(150) NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_method VARCHAR(30),
    amount_xof INTEGER NOT NULL DEFAULT 0 CHECK (amount_xof >= 0),
    amount_sats BIGINT DEFAULT 0 CHECK (amount_sats >= 0),
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    cancellation_reason TEXT,
    credit_available BOOLEAN NOT NULL DEFAULT FALSE,
    credit_expires_at TIMESTAMP,
    credit_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT appointments_status_check CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- ============================================================================
-- TABLE DOCUMENTS MEDICAUX
-- ============================================================================

CREATE TABLE IF NOT EXISTS medical_documents (
    id VARCHAR(100) PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
    doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
    hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    history JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    price_xof INTEGER NOT NULL DEFAULT 0 CHECK (price_xof >= 0),
    price_sats BIGINT NOT NULL DEFAULT 0 CHECK (price_sats >= 0),
    storage_cid VARCHAR(100),
    integrity_hash VARCHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT medical_documents_status_check CHECK (status IN ('draft', 'issued', 'sent', 'archived'))
);

-- Base médicale pseudonymisée pour les antécédents et pièces volumineuses.
CREATE TABLE IF NOT EXISTS medical_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_uuid UUID NOT NULL REFERENCES identity_registry(identity_uuid) ON DELETE CASCADE,
    record_type VARCHAR(50) NOT NULL,
    payload_encrypted JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP,
    CONSTRAINT medical_records_status_check CHECK (status IN ('DRAFT', 'VALIDATED', 'ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS idx_medical_records_identity ON medical_records(identity_uuid, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_records_status ON medical_records(status);

ALTER TABLE medical_documents ADD COLUMN IF NOT EXISTS history JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS credit_expires_at TIMESTAMP;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS credit_used_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_medical_documents_patient ON medical_documents(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_documents_doctor ON medical_documents(doctor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_documents_type ON medical_documents(document_type);

-- ============================================================================
-- TABLE INVOICES
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(50) PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id),
    doctor_id INTEGER REFERENCES doctors(id),
    hospital_id INTEGER REFERENCES hospitals(id),
    consultation_id INTEGER REFERENCES consultations(id),
    items JSONB NOT NULL,
    total_xof INTEGER NOT NULL,
    total_sats INTEGER,
    hash VARCHAR(64) UNIQUE NOT NULL,
    bitcoin_txid VARCHAR(64),
    qr_code TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    payment_method VARCHAR(20),
    payment_hash VARCHAR(64),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_hash ON invoices(hash);

-- ============================================================================
-- TABLE AUDIT LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    target_type VARCHAR(50),
    target_id INTEGER,
    details JSONB,
    blockchain_txid VARCHAR(64),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- TABLE NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- ============================================================================
-- TABLE TONTINES SANTÉ
-- ============================================================================

CREATE TABLE IF NOT EXISTS tontines (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    monthly_contribution INTEGER NOT NULL DEFAULT 10000,
    total_savings BIGINT DEFAULT 0,
    members_count INTEGER DEFAULT 1,
    creator_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tontines_status ON tontines(status);

-- ============================================================================
-- TABLE DONS DE SANG
-- ============================================================================

CREATE TABLE IF NOT EXISTS blood_donations (
    id VARCHAR(50) PRIMARY KEY,
    donor_id INTEGER REFERENCES users(id),
    donor_name VARCHAR(255) NOT NULL,
    blood_type VARCHAR(5) NOT NULL,
    quantity_ml INTEGER NOT NULL DEFAULT 450,
    donor_phone VARCHAR(20),
    blockchain_hash VARCHAR(66) NOT NULL,
    status VARCHAR(20) DEFAULT 'validated',
    donated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blood_donations_donor_id ON blood_donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_blood_donations_blood_type ON blood_donations(blood_type);

-- ============================================================================
-- TABLE FACTURES & INVOICES LIGHTNING
-- ============================================================================

CREATE TABLE IF NOT EXISTS lightning_invoices (
    id VARCHAR(100) PRIMARY KEY,
    amount_xof INTEGER NOT NULL,
    amount_sats BIGINT NOT NULL,
    bolt11 TEXT NOT NULL,
    payment_hash VARCHAR(64) UNIQUE NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    tx_hash VARCHAR(100),
    provider VARCHAR(50) DEFAULT 'lnbits',
    is_live BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lightning_invoices_hash ON lightning_invoices(payment_hash);
CREATE INDEX IF NOT EXISTS idx_lightning_invoices_paid ON lightning_invoices(is_paid);

-- ============================================================================
-- CONSENTEMENTS ET SESSIONS SECURISES
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS patient_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
    purpose VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT patient_consents_status_check CHECK (status IN ('active', 'revoked', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_patient_consents_patient ON patient_consents(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_patient_consents_doctor ON patient_consents(doctor_id, status);

-- ==========================================================================
-- DONNEES METIER DE L'ESPACE MEDECIN
-- ==========================================================================

CREATE TABLE IF NOT EXISTS doctor_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(30),
    specialty VARCHAR(100),
    consultation_fee INTEGER NOT NULL DEFAULT 5000,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    hospital_name VARCHAR(255),
    avatar VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctor_patients (
    doctor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    linked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_visit DATE,
    consultations_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (doctor_user_id, patient_id)
);

CREATE TABLE IF NOT EXISTS doctor_appointments (
    id VARCHAR(100) PRIMARY KEY,
    doctor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id INTEGER REFERENCES patients(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    time_slot VARCHAR(20) NOT NULL,
    patient_name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doctor_appointments_owner ON doctor_appointments(doctor_user_id, date);

CREATE TABLE IF NOT EXISTS doctor_consultations (
    id VARCHAR(100) PRIMARY KEY,
    doctor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    patient_name VARCHAR(255) NOT NULL,
    diagnostic TEXT NOT NULL,
    prescription TEXT,
    notes TEXT,
    blockchain_hash VARCHAR(66),
    ipfs_cid VARCHAR(255),
    ipfs_gateway_url TEXT,
    doctor_signature TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doctor_consultations_owner ON doctor_consultations(doctor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS doctor_consultation_drafts (
    id VARCHAR(100) PRIMARY KEY,
    doctor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    patient_name VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP,
    CONSTRAINT doctor_consultation_drafts_status_check CHECK (status IN ('DRAFT', 'VALIDATED'))
);

CREATE INDEX IF NOT EXISTS idx_doctor_drafts_owner ON doctor_consultation_drafts(doctor_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS doctor_prescriptions (
    id VARCHAR(100) PRIMARY KEY,
    doctor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    patient_name VARCHAR(255) NOT NULL,
    medication TEXT NOT NULL,
    dosage VARCHAR(255),
    frequency VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    doctor_signature TEXT,
    ipfs_cid VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctor_audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    doctor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    patient_name VARCHAR(255),
    details TEXT,
    tx_hash VARCHAR(100),
    ipfs_cid VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doctor_audit_owner ON doctor_audit_logs(doctor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(128) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expiry ON refresh_tokens(expires_at);

CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id VARCHAR(50) REFERENCES invoices(id) ON DELETE SET NULL,
    payer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    provider VARCHAR(40) NOT NULL,
    provider_reference VARCHAR(150) UNIQUE,
    amount_xof INTEGER NOT NULL CHECK (amount_xof > 0),
    amount_sats BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP,
    CONSTRAINT payment_transactions_status_check CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded'))
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);

-- ============================================================================
-- PORTEFEUILLES ET MOUVEMENTS FINANCIERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS wallet_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance_xof BIGINT NOT NULL DEFAULT 0 CHECK (balance_xof >= 0),
    balance_sats BIGINT NOT NULL DEFAULT 0 CHECK (balance_sats >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallet_accounts(id) ON DELETE CASCADE,
    payment_transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
    direction VARCHAR(10) NOT NULL,
    amount_xof BIGINT NOT NULL CHECK (amount_xof > 0),
    amount_sats BIGINT NOT NULL DEFAULT 0 CHECK (amount_sats >= 0),
    balance_after_xof BIGINT NOT NULL CHECK (balance_after_xof >= 0),
    reference VARCHAR(150) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT wallet_transactions_direction_check CHECK (direction IN ('credit', 'debit'))
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id, created_at DESC);

-- ============================================================================
-- JOURNAL DE RECONCILIATION DES WEBHOOKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(40) NOT NULL,
    event_reference VARCHAR(150),
    payload_hash VARCHAR(64) NOT NULL,
    signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    error_message TEXT,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_webhooks_provider ON payment_webhook_events(provider, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_payload ON payment_webhook_events(payload_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_webhooks_payload ON payment_webhook_events(provider, payload_hash);

-- ============================================================================
-- TABLE ANCRAGES IPFS & BLOCKCHAIN
-- ============================================================================

CREATE TABLE IF NOT EXISTS ipfs_anchors (
    cid VARCHAR(100) PRIMARY KEY,
    document_id VARCHAR(100),
    document_type VARCHAR(50) DEFAULT 'prescription',
    doctor_signature TEXT,
    blockchain_txid VARCHAR(66),
    gateway_url TEXT,
    pinned_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ipfs_anchors_doc_id ON ipfs_anchors(document_id);

-- ============================================================================
-- DONNÉES DE BASE OPÉRATIONNELLES (SEED)
-- ============================================================================

-- 1. Hôpitaux de référence au Bénin
INSERT INTO hospitals (id, name, address, city, country, latitude, longitude, type, phone, email, has_emergency, has_blood_bank)
VALUES
    (1, 'Hôpital de Zone d''Abomey-Calavi & Sô-Ava', 'Rue de l''Hôpital de Zone, Quartier Sèmè-Podji, Abomey-Calavi', 'Abomey-Calavi', 'Benin', 6.4385, 2.3412, 'public', '+229 01 21 36 01 22', 'contact@hz-calavi.bj', TRUE, TRUE),
    (2, 'CHD Atlantique (Hôpital Universitaire)', 'Route Inter-États, Campus UAC, Abomey-Calavi', 'Abomey-Calavi', 'Benin', 6.4182, 2.3395, 'public', '+229 01 21 36 12 44', 'contact@chd-atlantique.bj', TRUE, TRUE),
    (3, 'Clinique Privée Sainte-Famille', 'Quartier Zogbadjè, Face 2ème entrée UAC, Abomey-Calavi', 'Abomey-Calavi', 'Benin', 6.4255, 2.3298, 'private', '+229 01 97 45 11 89', 'contact@saintefamille.bj', TRUE, FALSE),
    (4, 'Centre National Hospitalier et Universitaire Hubert K. Maga (CNHU-HKM)', 'Avenue Jean-Paul II, Cotonou', 'Cotonou', 'Benin', 6.3639, 2.4183, 'public', '+229 01 21 30 01 55', 'direction@cnhu.bj', TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

SELECT setval('hospitals_id_seq', (SELECT MAX(id) FROM hospitals));

-- 2. Utilisateurs administratifs et praticiens de départ
INSERT INTO users (id, email, phone, password_hash, role)
VALUES
    (1, 'admin@santeplus.bj', '+229 01 21 00 00 01', '$2b$10$BmyP6HBNJrVaUzvt37Kl5OSqWxYY3ac31nXY5WrOfdwA//05HilgS', 'admin'),
    (2, 'direction@hz-calavi.bj', '+229 01 21 36 01 20', '$2b$10$8DMwuun/n6XdAIsKVtjg8OPlkVXfU3mLIV8dB2hO6s.OLZszRsATO', 'admin'),
    (3, 'dr.sossou@hz-calavi.bj', '+229 01 97 88 55 44', '$2b$10$k9.QpoG34Smk85Vo6NDd9uB0Hoa5iY.iI273l/9EvhTzw6WvB173S', 'doctor'),
    (4, 'medecin.demo@santeplus.bj', '+229 01 97 00 00 04', '$2b$10$/AtZ4V5bprp1w7OVUDGG9O8.8hCqvZMGXmc08WgrimOhkxHyQLh9m', 'doctor'),
    (5, 'hopital.demo@santeplus.bj', '+229 01 97 00 00 05', '$2b$10$I1Kd7dMU0VYEOQLpMwkkQeyHYo4akz51xbb2j0rbJJ0mY67BVEkEq', 'admin')
ON CONFLICT (email) DO NOTHING;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- 3. Profil Médecin de référence
INSERT INTO doctors (user_id, first_name, last_name, specialty, license_number, npi, hospital_id, consultation_fee)
VALUES
    (3, 'Jean', 'Sossou', 'Médecine Générale', 'ONMB-2020-001', 'BJ-1097-8855', 1, 5000)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO doctors (user_id, first_name, last_name, specialty, license_number, npi, hospital_id, consultation_fee)
VALUES
    (4, 'Démonstration', 'Médecin', 'Médecine Générale', 'ONMB-DEMO-004', 'BJ-1097-8856', 1, 5000)
ON CONFLICT (user_id) DO NOTHING;


