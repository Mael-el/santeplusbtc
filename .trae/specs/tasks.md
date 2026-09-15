# Système de Paiement SANTÉ+ Bénin - Plan d'Implémentation

## Task 1: Base de données - Migrations et table wallet_recharges
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Ajouter la table `wallet_recharges` à [init-db.sql](file:///home/shadow/santeplusbj-main/backend/init-db.sql) avec colonnes : id UUID, patient_id, amount_xof, amount_sats, method, provider, status, transaction_id, created_at, completed_at
  - Vérifier et compléter la table `invoices` avec les colonnes doctor_id/hospital_id (déjà présentes), ajouter colonnes `doctor_id`, `hospital_id` FK, s'assurer de la présence de `payment_hash`
  - Vérifier/ajouter index sur les tables financières
  - Ajouter les variables d'environnement webhook secrets à [.env.example](file:///home/shadow/santeplusbj-main/.env.example) : CINETPAY_WEBHOOK_SECRET, KKIAPAY_WEBHOOK_SECRET, FEEXPAY_WEBHOOK_SECRET, AGGREGATOR_CHOICE (cinetpay/kkiapay/feexpay/fedapay), CELTIIS_SUPPORT
- **Acceptance Criteria Addressed**: FR-7, AC-1, AC-6
- **Test Requirements**:
  - `rule` TR-1.1: Le script SQL s'exécute sans erreur sur une base vierge et `\d wallet_recharges` liste toutes les colonnes ; Evidence: `psql -f init-db.sql && psql -c "\dt"`
  - `rule` TR-1.2: .env.example contient les 6 nouvelles variables de configuration webhook/agrégateur ; Evidence: grep des variables

---

## Task 2: Service paiement unifié (payment.service.ts)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - Créer [payment.service.ts](file:///home/shadow/santeplusbj-main/backend/services/payment.service.ts) comme couche d'orchestration
  - Méthode `createWalletRecharge(patientId, amountXof, method, provider, phone?)` : crée demande, persiste PENDING, retourne demande
  - Méthode `confirmRechargeByTransactionId(transactionId, externalData)` : vérifie idempotence → crédite wallet → écriture transactions atomique
  - Méthode `createInvoice(doctorId, hospitalId, patientId, items, totalXof)` : hash SHA-256, INSERT invoices
  - Méthode `payInvoice(invoiceId, patientId, method)` :
    - Cas wallet: vérif solde → UPDATE balance → UPDATE invoice PAID → INSERT payment_transactions → INSERT wallet_transactions (transaction atomique)
    - Cas external: retourne demande paiement à initier (mobile money ou lightning)
  - Méthode `confirmInvoicePayment(invoiceId, externalRef, metadata)` : double-check invoice déjà PAID ? → update sinon
  - Validation montants : 0 < montant ≤ 100_000_000 FCFA
- **Acceptance Criteria Addressed**: FR-1, FR-2, FR-5, AC-1, AC-2, AC-6
- **Test Requirements**:
  - `rule` TR-2.1: createWalletRecharge + confirmRecharge → balance incrémentée + wallet_recharges COMPLETED ; Evidence: test unitaire avec mock dbService
  - `rule` TR-2.2: payInvoice avec insuffisance → 402 + pas de modification balance ; Evidence: test unitaire
  - `rule` TR-2.3: confirmRecharge appelé 2x avec même id → crédit UNE SEULE FOIS ; Evidence: vérification solde après double appel

---

## Task 3: Amélioration Mobile Money Service (CinetPay + Kkiapay + FeexPay + webhook verify)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - Améliorer [momo.service.ts](file:///home/shadow/santeplusbj-main/backend/services/momo.service.ts) :
    - Ajouter `FiatProvider` variants `cinetpay`, `kkiapay`, `feexpay`
    - Implémenter `initializePayment` adapter par provider:
      * CinetPay : POST `https://api-checkout.cinetpay.com/v2/payment` body { apikey, site_id, amount, currency, transaction_id, description, customer, notify_url, return_url, metadata }
      * Kkiapay : POST `https://api.kkiapay.me/v1/transactions` headers Authorization: Bearer {key}
      * FeexPay : POST selon documentation FeexPay (/api/v1/payment)
      * Fedapay : conservé, adapter notification webhook
    - Ajouter méthode `verifyPaymentStatus(provider, providerRef)` : appel API vérification double-check
    - Ajouter méthode `verifyWebhookSignature(provider, rawBody, signatureHeader)` : HMAC SHA-256 timingSafeEqual
    - Conserver la détection opérateur (préfixes MTN/Moov/Celtiis Bénin)
  - Ajouter providers `celtiis` support via agrégateur
- **Acceptance Criteria Addressed**: FR-3, FR-5, AC-1, AC-3
- **Test Requirements**:
  - `rule` TR-3.1: verifyWebhookSignature avec signature correcte → true ; incorrecte → false ; prod+absente → false ; Evidence: tests unitaires avec crypto
  - `rule` TR-3.2: initializePayment cinetpay construit le bon body / bonnes headers ; Evidence: test mock fetch vérif URL + body
  - `rule` TR-3.3: verifyPaymentStatus cinetpay appelle /payment/check avec cpm_trans_id ; Evidence: mock fetch inspecté

---

## Task 4: Amélioration Lightning Service (conversion + webhook + polling helper)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - Améliorer [lightning.service.ts](file:///home/shadow/santeplusbj-main/backend/services/lightning.service.ts) :
    - Ajouter `getXofToSatsRate()` : appel API taux change externe (coinbase/coingecko) avec fallback 1.666 si indisponible
    - Ajouter `createInvoiceWithConversion(amountXof, memo)` : rate convert → createInvoice → retour { amountXof, amountSats, ... }
    - Ajouter `verifyWebhookSignature(rawBody, signature, secret)` : HMAC SHA-256
    - Conserver l'existant createInvoice + checkPaymentStatus
    - Validation amountSats > 0
- **Acceptance Criteria Addressed**: FR-4, AC-4
- **Test Requirements**:
  - `rule` TR-4.1: createInvoiceWithConversion 10000 XOF → retour.amountSats ≈ 16660 (tolérance ±20%) ; Evidence: valeur retournée
  - `rule` TR-4.2: checkPaymentStatus sur payment_hash mocké paid=true → {paid:true} ; Evidence: test mock LNbits

---

## Task 5: Routes API V3 complètes (wallet, invoices, webhooks)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3, Task 4
- **Description**:
  - Modifier [payment.routes.ts](file:///home/shadow/santeplusbj-main/backend/routes/payment.routes.ts) ou étendre [server.ts](file:///home/shadow/santeplusbj-main/server.ts) routes `/api` :
  - **Wallet** :
    - `POST /api/wallet/recharge` (requireAuth, role patient) : body {amountXof, method, provider, phone?} → appel momo ou lightning service → retour { rechargeId, paymentUrl?, bolt11?, qrPayload?, status }
    - `GET /api/wallet/balance` (requireAuth, patient) : SELECT wallet_accounts balance_xof/balance_sats
    - `GET /api/wallet/recharges` (requireAuth, patient) : liste wallet_recharges ORDER BY created_at DESC
  - **Invoices** :
    - `POST /api/invoices` (requireAuth, role doctor) : body {patientNpi, items, totalXof, hospitalId?} → createInvoice
    - `GET /api/invoices` (requireAuth, patient ou doctor avec scope) : liste filtrée par propriétaire
    - `GET /api/invoices/:id` (requireAuth, propriétaire uniquement)
    - `POST /api/invoices/:id/pay` (requireAuth, patient propriétaire) : body {method, phone?, provider?} → switch wallet/mobileMoney/lightning
    - `GET /api/invoices/:id/status` (requireAuth) : polling status + check lightning paid via payment_hash
  - **Webhooks** (SANS requireAuth - signature seulement) :
    - `POST /api/webhooks/mobile-money` : rawBody préservé, extract provider via query ?provider=cinetpay, vérif HMAC, journaliser payment_webhook_events, idempotence, si succès → payment.service.confirmXxx
    - `POST /api/webhooks/lightning` : identique pour LNbits webhook
    - IMPORTANT: app.use(express.json({ verify: rawBody })) déjà présent dans server.ts (ligne 487-490), le réutiliser
  - Retirer les routes `/api/payments-v2` si doublon, unifier
- **Acceptance Criteria Addressed**: FR-1, FR-2, FR-3, FR-4, FR-5, AC-1, AC-2, AC-3, AC-7
- **Test Requirements**:
  - `rule` TR-5.1: POST /api/wallet/recharge → status 201 success:true + rechargeId présent ; Evidence: curl/supertest
  - `rule` TR-5.2: POST /api/invoices/:id/pay method=wallet avec facture existante+solde → status 200 invoice PAID ; Evidence: test
  - `rule` TR-5.3: POST /api/webhooks/mobile-money avec mauvaise signature prod → 403 + 0 écriture ; Evidence: test avec signature falsifiée
  - `rule` TR-5.4: Tous endpoints respectent format { success, data?, error? } ; Evidence: 4 réponses JSON inspectées

---

## Task 6: Types frontend + API client (nouveaux endpoints)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 5
- **Description**:
  - Étendre [src/types.ts](file:///home/shadow/santeplusbj-main/src/types.ts) :
    - Ajouter type `WalletRecharge` : { id, patientId, amountXof, amountSats, method: 'mobile_money'|'lightning', provider, status, transactionId, createdAt, completedAt }
    - Ajouter type `PaymentMethod` : 'wallet' | 'mtn' | 'moov' | 'celtiis' | 'lightning'
    - Étendre `Invoice` avec status PENDING|PAID|FAILED|REFUNDED, paymentHash, paidAt
  - Étendre [src/services/api.ts](file:///home/shadow/santeplusbj-main/src/services/api.ts) :
    - `walletRecharge(amountXof: number, method: PaymentMethod, provider: string, phone?: string): Promise<WalletRecharge & { paymentUrl?: string; bolt11?: string }>`
    - `getWalletBalance(): Promise<{ balanceXof: number; balanceSats: number }>`
    - `getWalletRecharges(): Promise<WalletRecharge[]>`
    - `createInvoice(payload): Promise<Invoice>`
    - `payInvoice(invoiceId: string, method: PaymentMethod, provider?: string, phone?: string): Promise<Invoice>`
    - `getInvoiceStatus(invoiceId: string): Promise<{ status: string; paid: boolean }>`
- **Acceptance Criteria Addressed**: FR-6
- **Test Requirements**:
  - `rule` TR-6.1: Typescript `tsc --noEmit` passe SANS erreur avec nouveaux types ; Evidence: npm run lint
  - `rule` TR-6.2: apiClient.walletRecharge appelle POST /api/wallet/recharge avec bons paramètres ; Evidence: mock axios inspecté

---

## Task 7: Composant RechargeWalletModal (UI complète 5 étapes)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 6
- **Description**:
  - Créer [src/components/Wallet/RechargeWalletModal.tsx](file:///home/shadow/santeplusbj-main/src/components/Wallet/RechargeWalletModal.tsx) (dossier Wallet à créer)
  - 5 étapes internes gérées par useState `'amount' | 'method' | 'processing' | 'success' | 'failure'`
  - **Étape amount** :
    - Boutons rapides 5k, 10k, 25k FCFA (hauteur ≥56px, fond #00a86b activé)
    - Input montant personnalisé (FCFA, min 100, validation)
    - Bouton "Continuer" vert #00a86b
  - **Étape method** :
    - 4 cartes (MTN, Moov, Celtiis, Lightning) avec logo placeholder SVG ou initiales colorées
    - Carte sélectionnée bordure #00a86b + fond léger
    - Input phone pour Mobile Money (pré-rempli du user, placeholder "+229 ...")
    - Bouton "Payer X FCFA"
  - **Étape processing** : Spinner/loader animé, texte "En attente de confirmation...", statut temps réel (polling toutes 2s)
  - **Étape success** : Icône CheckCircle2 verte, texte "Paiement réussi", nouveau solde affiché, bouton "Terminer"
  - **Étape failure** : Icône XCircle rouge, message erreur explicite, 2 boutons "Réessayer" + "Contacter le support"
  - Design : fond blanc carte, tailwind, min hauteur boutons 56px, police ≥18px sur titres, responsive mobile-first
  - Intégration avec apiClient + onSuccess callback pour rafraîchir balance parent
- **Acceptance Criteria Addressed**: FR-6, AC-5
- **Test Requirements**:
  - `rubric` TR-7.1: Conformité design ; Scale 1-5 ; Anchors 1=pas d'étapes, 3=3 étapes, 5=5 étapes complètes + couleurs #00a86b/Blanc, boutons ≥56px, polices tailles conformes ; Threshold ≥4 ; Evidence: rendu React + classes/CSS inspectés
  - `rule` TR-7.2: Submit montant 10000 + MTN → appel POST /api/wallet/recharge (mock) avec bons paramètres ; Evidence: mock fetch appelé

---

## Task 8: Composant InvoicePaymentModal + Modernisation PaymentFlow
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 6
- **Description**:
  - Créer [src/components/Invoice/InvoicePaymentModal.tsx](file:///home/shadow/santeplusbj-main/src/components/Invoice/InvoicePaymentModal.tsx) :
    - Props : invoice (objet Invoice), onPaid callback, onClose
    - Récapitulatif facture : lignes items, total, hôpital, date
    - Sélecteur méthode : 5 options (Wallet Santé+, MTN, Moov, Celtiis, Lightning)
    - Pour wallet : affichage solde actuel, désactivé si insuffisant avec message
    - Pour Mobile Money : champ téléphone pré-rempli
    - Pour Lightning : QR Code SVG avec bolt11 retourné par API
    - États processing/success/failure idem RechargeModal
    - Appel POST /api/invoices/:id/pay + polling statut paiement Lightning
  - Intégrer RechargeWalletModal dans [WalletTab.tsx](file:///home/shadow/santeplusbj-main/src/components/WalletTab.tsx) : remplacer modal top-up mocké existant par le nouveau (bouton "Recharger +" dans la carte wallet balance)
  - Remplacer si besoin la logique de paiement dans [PaymentFlow.tsx](file:///home/shadow/santeplusbj-main/src/components/PaymentFlow.tsx) avec le composant InvoicePaymentModal à l'étape "pay-options"
- **Acceptance Criteria Addressed**: FR-2, FR-6, AC-5
- **Test Requirements**:
  - `rule` TR-8.1: Méthode "wallet" + solde insuffisant → bouton désactivé + message "Solde insuffisant" visible ; Evidence: test rendu conditionnel
  - `rule` TR-8.2: Paiement réussi (mock 200) → onPaid callback appelé ; Evidence: jest/spy onPaidCalled=true
  - `rubric` TR-8.3: Cohérence design avec RechargeModal ; Scale 1-5 ; Anchors 1=décor hétérogène, 3=mêmes couleurs, 5=mêmes composants, mêmes étapes, mêmes mesures UI ; Threshold ≥4 ; Evidence: comparaison visuelle classes

---

## Task 9: Intégration server.ts + webhook raw body + health check paiements
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 5
- **Description**:
  - Dans [server.ts](file:///home/shadow/santeplusbj-main/server.ts) :
    - Importer et utiliser les routes nouvellement organisées `/api/wallet/*` et `/api/invoices/*` et `/api/webhooks/*` (en dehors du router requireAuth car webhooks pas d'authentification JWT)
    - Garantir que les routes `/api/webhooks/*` sont ENREGISTRÉES AVANT requireAuth global (si appliqué)
    - Vérifier que `express.json({ verify: rawBody })` est présent
    - Mettre à jour `/api/health` pour retourner aussi `services.mobileMoneyProvider` et `services.aggregator`
    - Vérifier la validation production des variables : ajouter AGGREGATOR_CHOICE + CINETPAY_WEBHOOK_SECRET dans la liste "missing production configuration" (lignes 408-433)
  - Mettre à jour package.json si besoin (aucune dépendance nouvelle attendue - tout existe déjà : pg, axios, crypto, qrcode.react, jspdf, lucide-react, motion)
- **Acceptance Criteria Addressed**: FR-5, AC-3, NFR-1
- **Test Requirements**:
  - `rule` TR-9.1: Build `npm run build` compile sans erreur TypeScript ; Evidence: exit code 0
  - `rule` TR-9.2: Route POST /api/webhooks/mobile-money accessible SANS header Authorization (ne nécessite pas JWT) ; Evidence: requête sans token = 403 signature (pas 401 auth)

---

## Task 10: Tests bout-en-bout & lint + correction diagnostics
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 7, Task 8, Task 9
- **Description**:
  - Exécuter `npm run lint` (tsc --noEmit) et corriger TOUTES erreurs TypeScript
  - Exécuter `GetDiagnostics` VS Code pour identifier erreurs de lint/type restantes
  - Exécuter `npm test` (vitest) : si échecs liés aux modifications, corriger
  - Optionnel : ajouter tests unitaires vitest dans `backend/services/__tests__/` pour payment.service.ts :
    - `payment.service.test.ts` : idempotence confirm, création recharge, paiement wallet insuffisance
  - Vérifier manuellement que les 10 endpoints AC-7 répondent
- **Acceptance Criteria Addressed**: Tous les AC via exécution
- **Test Requirements**:
  - `rule` TR-10.1: `npm run lint` exit code 0, 0 erreur TypeScript ; Evidence: stdout
  - `rule` TR-10.2: `npm test` existants passent (timeout 60s) ; Evidence: vitest summary
  - `rubric` TR-10.3: Couverture des cas critiques (tests présents) ; Scale 1-5 ; Anchors 1=aucun test, 3=tests existants maintenus, 5=tests spécifiques paiement ajoutés (idempotence, insuffisance, HMAC) ; Threshold ≥3 ; Evidence: fichier(s) test
