# Système de Paiement Complet SANTÉ+ Bénin - Product Requirements Document

## Overview
- **Summary**: Implémentation d'un système de paiement complet, sécurisé et production-ready pour la plateforme SANTÉ+ au Bénin. Le système gère la recharge du portefeuille patient (wallet), le paiement des factures médicales, et intègre Mobile Money (MTN/Moov/Celtiis via agrégateurs CinetPay/Kkiapay/FeexPay) et Lightning Network (LNbits).
- **Purpose**: Permettre à des millions de Béninois de régler leurs dépenses de santé en toute sécurité via les canaux de paiement locaux (Mobile Money) et internationaux (Lightning), avec une validation serveur stricte via webhooks signés.
- **Target Users**: Patients béninois (paiement Mobile Money & Lightning), médecins (génération de factures), administrateurs (suivi des transactions).

## Goals
1. Recharge du wallet patient via MTN MoMo, Moov Money, Celtiis Cash et Lightning Network
2. Paiement de factures médicales via wallet, Mobile Money (4 opérateurs) et Lightning
3. Validation systématique côté serveur via webhooks signés HMAC
4. Idempotence complète des transactions (anti double-processing)
5. Journalisation immuable de toutes les opérations financières
6. Interface frontend responsive respectant le design vert (#00a86b) & blanc
7. Gestion des échecs de paiement avec retry et support

## Non-Goals
- Intégration directe avec les APIs MTN/Moov/Celtiis individuelles (passage par agrégateur uniquement)
- Gestion des cartes bancaires (Visa/Mastercard) hors scope V1
- Comptabilité multi-hôpitaux avancée (répartition financière)
- Gestion de factures en devises autres que XOF et BTC satoshis

## Background & Context
### État actuel du codebase
- Tables PostgreSQL existantes : `wallet_accounts`, `wallet_transactions`, `invoices`, `payment_transactions`, `payment_webhook_events`
- Services existants : `momo.service.ts` (FedaPay/Kkiapay/Izichange basic), `lightning.service.ts` (LNbits/Breez/Izichange basic)
- Routes existantes : `payment.routes.ts` (v2 basique, invoices + wallet + refund)
- Frontend existant : `PaymentFlow.tsx` (complexe, multi-étapes), `WalletTab.tsx` (modal top-up mocké)
- Types existants : interfaces `Invoice`, `Patient` in [types.ts](file:///home/shadow/santeplusbj-main/src/types.ts)
- Variables d'environnement existantes : `.env.example` avec FIAT_PROVIDER, LNBITS_URL, clés API

### Décisions prises
- Agrégateurs recommandés : CinetPay (couverture MTN+Moov Bénin), Kkiapay (local Bénin), FeexPay
- Validation paiement : JAMAIS côté client, TOUJOURS via webhook + API de vérification
- Devise primaire : Franc CFA (XOF) ; devise secondaire : Satoshis (pour Lightning)
- Couleurs UI : fond blanc, boutons vert #00a86b, texte #0a1f1a, rouge erreur uniquement

## Functional Requirements

### FR-1 : Recharge du Wallet Patient
- **FR-1.1**: Choix du montant via boutons rapides (5 000, 10 000, 25 000 FCFA) ou champ personnalisé
- **FR-1.2**: Sélection de la méthode : MTN MoMo, Moov Money, Celtiis Cash, Lightning Network
- **FR-1.3**: Création backend d'une demande de paiement avec statut PERSISTANT PENDING
- **FR-1.4**: Appel API agrégateur Mobile Money avec notify_url, return_url, customer_phone
- **FR-1.5**: Génération facture Lightning (BOLT11 + QR Code) via LNbits
- **FR-1.6**: Confirmation asynchrone via webhook → mise à jour du solde wallet
- **FR-1.7**: Endpoints : `POST /api/wallet/recharge`, `GET /api/wallet/balance`, `GET /api/wallet/recharges`

### FR-2 : Paiement des Factures Médicales
- **FR-2.1**: Création de facture par le médecin (statut PENDING) avec hash d'intégrité
- **FR-2.2**: Notification patient "Facture à payer"
- **FR-2.3**: Quatre méthodes de paiement : Wallet Santé+, MTN, Moov, Celtiis, Lightning
- **FR-2.4**: Vérification solde wallet avant paiement par wallet
- **FR-2.5**: Mise à jour statut facture → PAID + paid_at + payment_method + payment_hash
- **FR-2.6**: Notification médecin "Paiement reçu"
- **FR-2.7**: Génération de reçu PDF après confirmation
- **FR-2.8**: Endpoints : `POST /api/invoices`, `GET /api/invoices`, `GET /api/invoices/:id`, `POST /api/invoices/:id/pay`, `GET /api/invoices/:id/status`

### FR-3 : Intégration Mobile Money (Agrégateur)
- **FR-3.1**: Support multi-agrégateur : CinetPay, Kkiapay, FeexPay (configurable via env)
- **FR-3.2**: Initialisation paiement : amount XOF, currency XOF, description, customer_phone, notify_url, return_url
- **FR-3.3**: URL de paiement renvoyée au frontend pour redirection/opérateur
- **FR-3.4**: Traitement webhook `POST /api/webhooks/mobile-money`
- **FR-3.5**: Vérification signature HMAC du webhook avant TOUT traitement
- **FR-3.6**: Double vérification statut via API de vérification agrégateur (cinetpay check)
- **FR-3.7**: Gestion statut "WAITING_FOR_CUSTOMER" → pas d'échec, attendre
- **FR-3.8**: Détection opérateur (préfixes Bénin) à partir du numéro de téléphone

### FR-4 : Intégration Lightning Network (LNbits)
- **FR-4.1**: Création facture via `POST /api/v1/payments` LNbits (out=false, amount sats, memo)
- **FR-4.2**: Retour payment_hash + payment_request BOLT11 + conversion XOF↔sats
- **FR-4.3**: Affichage QR Code BOLT11 côté frontend
- **FR-4.4**: Vérification statut via polling `GET /api/v1/payments/{payment_hash}`
- **FR-4.5**: Traitement webhook Lightning `POST /api/webhooks/lightning` (si LNbits le supporte)
- **FR-4.6**: Taux de change XOF → sats via API externe (ou fallback config)

### FR-5 : Sécurité & Idempotence
- **FR-5.1**: Signature HMAC SHA-256 vérifiée sur TOUS les webhooks entrants
- **FR-5.2**: Rejet immédiat HTTP 403 si signature invalide (production)
- **FR-5.3**: Idempotence via `transaction_id` + table `payment_webhook_events` (contrainte UNIQUE provider+payload_hash)
- **FR-5.4**: Vérification "déjà traité" avant toute opération de crédit/débit
- **FR-5.5**: Transactions DB atomiques (BEGIN/COMMIT) pour recharge + paiement facture
- **FR-5.6**: Aucune clé API hardcodée → variables d'environnement uniquement
- **FR-5.7**: Journalisation complète dans `audit_logs` + tables financières

### FR-6 : Interface Frontend (Paiement)
- **FR-6.1**: Écran recharge : montants rapides (5k/10k/25k) + personnalisé
- **FR-6.2**: Écran méthode : 4 boutons MTN/Moov/Celtiis/Lightning avec icônes
- **FR-6.3**: Écran "paiement en cours" : loader animé + message statut temps réel
- **FR-6.4**: Écran succès : ✅ + montant + nouveau solde + bouton retour
- **FR-6.5**: Écran échec : ❌ + message erreur + boutons "Réessayer" / "Contacter support"
- **FR-6.6**: Design : fond blanc, boutons #00a86b, texte #0a1f1a, police ≥18px, boutons ≥56px hauteur

### FR-7 : Base de Données
- **FR-7.1**: Table `wallet_recharges` : id UUID, patient_id, amount_xof, amount_sats, method, provider, status, transaction_id, created_at, completed_at
- **FR-7.2**: Table `invoices` : colonnes doctor_id, hospital_id, items JSONB, total_xof, total_sats, hash, status, payment_method, payment_hash, paid_at (compléter si manquant)
- **FR-7.3**: Table `transactions` unifiée : id UUID, patient_id, type, reference_id, amount_xof, amount_sats, method, provider, status, transaction_id, payment_hash, metadata JSONB, created_at, completed_at
- **FR-7.4**: Index de performance sur patient_id, status, transaction_id, created_at

## Non-Functional Requirements

### NFR-1 : Sécurité Production
- **NFR-1.1**: Toutes communications HTTPS TLS 1.3 (en-tête Helmet configuré)
- **NFR-1.2**: Webhooks non signés rejetés en production
- **NFR-1.3**: Validation entrées backend : montants > 0, ≤ 100 000 000 FCFA, téléphone format Bénin
- **NFR-1.4**: Aucune validation côté client faisant autorité

### NFR-2 : Fiabilité & Échelle
- **NFR-2.1**: Idempotence garantie sur 100% des webhooks dupliqués
- **NFR-2.2**: Retour HTTP 200 immédiat sur webhook AVANT traitement métier lourd
- **NFR-2.3**: Timeouts sur appels agrégateur/LNbits + retry exponentiel
- **NFR-2.4**: Disposition fallback sandbox en développement

### NFR-3 : Performance
- **NFR-3.1**: Réponses API < 200ms hors appels externes
- **NFR-3.2**: Polling Lightning 2-3s intervalle, timeout 15min
- **NFR-3.3**: Index DB sur colonnes fréquemment interrogées

### NFR-4 : Observabilité
- **NFR-4.1**: Logs structurés : id, montant, méthode, statut, timestamp, hash
- **NFR-4.2**: Table `payment_webhook_events` pour audit webhooks
- **NFR-4.3**: Métriques endpoint `/api/health/ready` mis à jour avec statut paiement

### NFR-5 : UX & Accessibilité
- **NFR-5.1**: Police minimum 18px, hauteur bouton minimum 56px
- **NFR-5.2**: Contraste WCAG AA (vert #00a86b sur blanc)
- **NFR-5.3**: États de chargement clairs, pas d'écrans figés
- **NFR-5.4**: Messages d'erreur explicites en français

## Constraints
- **Technical**: Node.js + Express + TypeScript + PostgreSQL backend ; React + Vite + TypeScript frontend ; intégrations via fetch HTTP
- **Business**: Conformité aux opérateurs Bénin (MTN 97/96/61..., Moov 95/94/66...) ; tarification en FCFA uniquement pour Mobile Money
- **Dependencies**: Variables d'environnement pour clés agrégateur, LNbits URL+clé, webhook secrets ; package.json déjà à jour (axios, pg, qrcode.react, jspdf)

## Assumptions
1. L'agrégateur CinetPay/Kkiapay/FeexPay fournit une API REST + webhooks signés HMAC
2. LNbits est accessible via URL publique avec clé API valide en production
3. Le domaine public SANTÉ+ expose les endpoints webhooks en HTTPS
4. Patients disposent d'un numéro MTN/Moov/Celtiis Bénin ou d'un wallet Lightning
5. PostgreSQL est accessible avec les droits CREATE TABLE pour les migrations

## Open Questions
- [ ] L'option "Celtiis Cash" est-elle disponible via un des agrégateurs CinetPay/Kkiapay/FeexPay ou faut-il un autre provider ?
- [ ] Faut-il implémenter le remboursement automatique sur échec délai, ou laisser l'administrateur faire ?
- [ ] Les frais de transaction Mobile Money sont-ils à la charge du patient ou absorbés par SANTÉ+ ?

---

## Acceptance Criteria

### AC-1 : Recharge Wallet via Mobile Money validée par webhook
- **Type**: `rule`
- **Given**: Un patient authentifié avec un numéro MTN Bénin valide, choisit 10 000 FCFA et MTN Mobile Money
- **When**: Le backend crée une demande, reçoit un webhook signé HMAC avec statut "SUCCESS" puis vérifie via API de vérification
- **Then**: (1) wallet_recharges.status = COMPLETED, (2) wallet_accounts.balance_xof augmente de 10 000, (3) une transaction est créée en type=recharge, (4) idempotence : second webhook identique ne modifie RIEN
- **Pass Condition**: Les 4 sous-conditions sont vérifiables par des requêtes SQL et une répétition de webhook ne crée qu'un seul crédit
- **Evidence**: Tests unitaires + appels POST /api/wallet/recharge → POST webhook duplicat → SELECT SQL

### AC-2 : Paiement Facture via Wallet Santé+
- **Type**: `rule`
- **Given**: Une facture PENDING de 5 000 FCFA, patient avec balance = 15 000 FCFA
- **When**: POST /api/invoices/:id/pay avec method=wallet
- **Then**: (1) invoices.status = PAID, paid_at rempli, payment_hash présent ; (2) wallet balance = 10 000 ; (3) wallet_transactions debit inséré ; (4) payment_transactions confirmé ; (5) SI solde insuffisant → 402 + pas de modif DB
- **Pass Condition**: Cas succès + cas échec solde insuffisant passent tous deux sans corruption de solde
- **Evidence**: Test avec facture + balance adéquate, puis tentative sur balance nulle

### AC-3 : Intégrité Webhook Signature HMAC
- **Type**: `rule`
- **Given**: Une requête webhook avec signature HMAC calculée sur le body JSON
- **When**: La signature est modifiée d'un caractère OU le secret est absent en production
- **Then**: (1) HTTP 403 si signature invalide ET NO_ENV=production ; (2) aucune écriture DB ; (3) ligne payment_webhook_events avec signature_valid=false
- **Pass Condition**: Requête forgée est rejetée et persiste dans le journal d'échec
- **Evidence**: Test avec crypto.timingSafeEqual, signature valide vs invalide vs absente

### AC-4 : Facture Lightning + QR Code + Polling
- **Type**: `rule`
- **Given**: Facture 8 000 FCFA via méthode=lightning
- **When**: Backend appelle LNbits createInvoice → retour BOLT11+payment_hash → frontend affiche QR → 5s plus tard paiement confirmé
- **Then**: (1) lightning_invoices.payment_hash unique ; (2) invoices.status = PAID après polling ; (3) conversion amount_sats ≈ 8000 * XOF_TO_SATS ; (4) QR code data = BOLT11 exact
- **Pass Condition**: Flux complet invoice→QR→paid sans intervention
- **Evidence**: Mock fetch LNbits + simulateur paid=true après intervalle

### AC-5 : Interface Recharge Design Conforme
- **Type**: `rubric`
- **Dimension**: Conformité design & UX du flux de recharge wallet
- **Scale**: 1-5
- **Anchors**: 1 = couleurs hors thème, pas de boutons rapides, hauteur < 48px ; 3 = couleurs correctes, 3 boutons rapides, texte petit ; 5 = fond blanc, boutons #00a86b, 4 méthodes avec logos, 3 montants rapides + perso, hauteur boutons ≥ 56px, police ≥ 18px, écrans succès/échec avec icônes ✅❌
- **Pass Threshold**: >= 4
- **Evidence**: Capture d'écran DOM + inspection classes CSS (hauteur, couleurs, polices)

### AC-6 : Idempotence & Persistance
- **Type**: `rule`
- **Given**: 5 appels identiques au webhook Mobile Money (même transaction_id)
- **When**: Tous les 5 appels sont traités séquentiellement
- **Then**: (1) wallet crédité UNE SEULE FOIS ; (2) 5 lignes payment_webhook_events ; (3) status 200 renvoyé aux 5 appels
- **Pass Condition**: Solde final = initial + montant (pas *5)
- **Evidence**: Boucle 5x POST webhook, SELECT count(*) + balance avant/après

### AC-7 : API Endpoints Complets
- **Type**: `rule`
- **Given**: Serveur lancé
- **When**: Requêtes HTTP sur : POST /api/wallet/recharge, GET /api/wallet/balance, GET /api/wallet/recharges, POST /api/invoices, GET /api/invoices, GET /api/invoices/:id, POST /api/invoices/:id/pay, GET /api/invoices/:id/status, POST /api/webhooks/mobile-money, POST /api/webhooks/lightning
- **Then**: Tous retournent un code HTTP cohérent (200/201/400/401/403/404) et un JSON `{ success: boolean, data?, error? }` standard
- **Pass Condition**: Chaque endpoint répond sans crash 500 sur cas standard
- **Evidence**: Script curl ou test supertest sur les 10 endpoints
