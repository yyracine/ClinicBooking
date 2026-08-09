# Architecture — Clinic Bookings

Application de prise de rendez-vous pour une clinique : réservation en ligne par
les patients, gestion du planning, des paiements, des dossiers médicaux et des
praticiens par l'équipe.

---

## 1. Vue d'ensemble de la pile

| Couche       | Technologie                                       | Rôle                                                     |
| ------------ | ------------------------------------------------- | -------------------------------------------------------- |
| Frontend     | Vite + React 19 + TypeScript                      | SPA : landing, authentification, dashboard               |
| Styles       | Tailwind CSS v4 + shadcn/ui (`src/components/ui/`) | Thème « Modern » : neutres, accent teal, cartes arrondies |
| Backend/BDD  | Convex (TypeScript)                               | Queries (lecture réactive), mutations (écriture), actions (effets externes), scheduler, stockage de fichiers |
| Auth         | Convex Auth (`src/convex/auth.ts`)                | 4 fournisseurs : mot de passe, code e-mail OTP, anonyme, mot de passe partagé de l'administration |
| E-mail       | Elastic Email v4 (action Convex)                  | E-mails transactionnels (confirmation, rappel J-1)       |
| Outils       | Bun                                               | `bun convex dev --once` (codegen), `bun tsc -b --noEmit` (types) |

---

## 2. Structure des dossiers

```
src/
├── main.tsx / pages/            → Routes : landing, /auth, /dashboard, 404
│   ├── Landing.tsx              → Page d'accueil publique
│   ├── Auth.tsx                 → Connexion (code e-mail / mot de passe / administration)
│   └── Dashboard.tsx            → Espace connecté (navigation patient/administration)
├── components/
│   ├── dashboard/               → UI métier
│   │   ├── BookAppointment.tsx  → Réservation (service → praticien → créneau)
│   │   ├── MyAppointments.tsx   → Rendez-vous du patient connecté
│   │   ├── MyRecord.tsx         → Dossier médical côté patient (PDF, pièces jointes)
│   │   ├── StaffPlanning.tsx    → Planning de l'équipe : stats, tableau, calendrier, paiements
│   │   ├── StaffCalendar.tsx    → Calendrier semaine / mois + congés
│   │   ├── StaffPatients.tsx    → Recherche patients + dossier enrichi (visites, signes vitaux, fichiers)
│   │   ├── StaffDoctors.tsx     → Fiches médecins + congés / indisponibilités
│   │   ├── PatientProfileForm.tsx, RoleGate.tsx, StatusBadge.tsx, AppointmentCard.tsx
│   └── ui/                      → Composants shadcn/ui (Button, Dialog, Select…)
├── lib/
│   ├── clinic.ts                → Helpers partagés front (formats FR, teintes, types de contrat)
│   └── pricing.ts               → Calcul du reste à charge selon l'assurance
├── hooks/                       → use-auth, use-mobile
└── convex/                      → BACKEND : tout le code serveur
    ├── schema.ts                → Tables + index (source de vérité)
    ├── auth.ts / auth/          → Config Convex Auth + fournisseurs (OTP, administration)
    ├── appointments.ts          → Réservation, annulation, paiement, statuts, rappel J-1
    ├── catalog.ts               → Services, médecins, créneaux disponibles (dont jours de congé)
    ├── doctors.ts               → Fiches médecins + gestion des congés
    ├── records.ts               → Fiches patient, dossier médical, pièces jointes
    ├── emails.ts                → Actions d'envoi d'e-mails (Elastic Email)
    ├── settings.ts              → Paramètres clé/valeur (mot de passe de l'administration)
    ├── demo.ts / seed.ts / seedDemo.ts → Données de démonstration
    └── _generated/              → Types auto-générés (NE PAS éditer)
```

**Principe clé Convex** : le frontend appelle des fonctions typées (`api.x.y`)
comme des fonctions locales. Les **queries** sont réactives (l'UI se met à jour
quand la BDD change) ; les **mutations** écrivent de façon transactionnelle ;
les **actions** font des effets externes (fetch HTTP) ; le **scheduler**
exécute du code de façon fiable, plus tard (survit aux redémarrages).

---

## 3. Modèle de données (`src/convex/schema.ts`)

| Table              | Rôle                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `users`            | Comptes (patients + administration), rôle `patient` \| `staff`            |
| `services`         | Spécialités médicales (nom, durée, prix FCFA, icône, couleur)        |
| `doctors`          | Fiches praticiens : spécialité, téléphone, tarif, jours/heures de vacation |
| `appointments`     | Rendez-vous : patient, service, médecin, date, heure, statut, paiement |
| `patientProfiles`  | Fiche patient : identité, adresse, allergies, antécédents, assurance |
| `visits`           | Comptes rendus de consultation (+ signes vitaux : poids, taille, TA, température) |
| `medicalFiles`     | Pièces jointes d'une visite (stockage Convex)                        |
| `doctorOffDays`    | Congés / indisponibilités des médecins (ferment les créneaux)        |
| `clinicSettings`   | Paramètres clé/valeur (mot de passe partagé de l'administration)            |
| `notifications`    | Notifications in-app (cloche) : confirmation, rappels, créneaux libérés, nouveau RDV pour l'équipe |

### Cycle de vie d'un rendez-vous

```
pending ──paiement validé──► confirmed ──soin effectué──► completed
   │                            │
   └──annulation────────────► cancelled
```

- `pending` : réservé en ligne, en attente de paiement à la clinique.
- `confirmed` : **atteint uniquement** via `recordPayment` (validation du paiement).
- `cancelled` / `completed` : gérés par l'équipe (`updateAppointmentStatus`).

---

## 4. Flux principaux

### 4.1 Réservation (patient)

```
Landing → /auth → Dashboard (fiche patient obligatoire)
  → BookAppointment : service → praticien → date → créneau
  → mutation bookAppointment (appointments.ts)
      ├─ revalide la disponibilité côté serveur (computeAvailableSlots)
      └─ insère le rendez-vous en statut "pending"
```

### 4.2 Confirmation + rappels (multi-canaux : e-mail + SMS + notification in-app)

```
 L'équipe valide le paiement ──► recordPayment (appointments.ts)
   │ 1. Reste à charge = tarif médecin − part assurance  (lib/pricing.ts)
   │ 2. Patch : statut = "confirmed", amountPaid, paidAt
   │ 3. Confirmation : scheduler.runAfter(0, api.emails.sendAppointmentConfirmation,
   │                    { userId, to, phone, … })
   │ 4. Rappels multiples : pour chaque { daysBefore, runAt } de
   │    reminderScheduleTimes(date, time) (J-7, J-3, J-1 encore futurs) →
   │    scheduler.runAt(runAt, api.emails.sendAppointmentReminder,
   │                    { appointmentId, daysBefore })
   ▼
 emails.ts (actions) ──► 1. notification in-app (api.notifications.create, toujours)
                     ──► 2. POST api.elasticemail.com/v4/emails  (si e-mail)
                     ──► 3. POST api.twilio.com/.../Messages.json  (si téléphone,
                             numéro normalisé toE164)
   ├─ sendAppointmentConfirmation → « Votre rendez-vous est confirmé » (immédiat)
   └─ sendAppointmentReminder(daysBefore) → « Rappel : J-7 / J-3 / demain »
        └─ re-vérifie via la query getReminderInfo : statut ≠ "confirmed"
           (annulé/terminé) → aucun canal n'est déclenché
```

Points de robustesse :

- Le **scheduler** (`runAfter` / `runAt`) garantit l'exécution, survit aux
  redémarrages et ne bloque jamais la mutation de paiement.
- `getReminderInfo` relit le statut **au moment de l'envoi** : un rendez-vous
  annulé entre la confirmation et la veille ne reçoit pas de rappel erroné.
- Chaque canal dégrade doucement : `ELASTICEMAIL_API_KEY` (e-mail),
  `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_PHONE_NUMBER` (SMS) sont
  lus côté serveur (`process.env`, onglet « Keys ») ; sans clé, le canal
  journalise un avertissement et le flux continue (mode démo).
- Les actions n'ont pas de `ctx.db` : elles lisent via `ctx.runQuery`
  (queries internes sans session, id non devinable) et écrivent via
  `ctx.runMutation`. Le type de retour est annoté explicitement pour briser
  la référence circulaire `api` (même convention que `seedDemo.ts`).

### 4.3 Paiements mobiles (CinetPay — mode démo activable)

```
StaffPlanning (dialogue de paiement) → api.payments.getIntegrationStatus
  └─ section « Paiement mobile » : badge Actif / Mode démo
  └─ createMobilePaymentRequest (action) : reste à charge → demande CinetPay v2
     (Orange Money / MTN MoMo / Wave, devise XOF) ; sans clé CINETPAY_API_KEY /
     CINETPAY_SITE_ID → mode démo (réf. + montant, lien factice)
  └─ recordMobilePayment (mutation) : le patient a payé → statut "confirmed",
     confirmation multi-canaux + rappels J-7/J-3/J-1 (mêmes règles que
     recordPayment)
```

### 4.4 Dossier médical (patient / administration)

```
StaffPatients : recherche → getPatientRecord (records.ts)
  ├─ fiche patient (allergies, antécédents, assurance)
  ├─ visites (addVisit : compte rendu + signes vitaux + médicaments + examens)
  ├─ pièces jointes (generateUploadUrl → upload → attachVisitFile → deleteVisitFile)
  └─ MyRecord côté patient : mêmes données + exports PDF (ordonnance, dossier)
```

### 4.5 Planning et congés (administration)

```
StaffPlanning : allAppointments + listDoctorOffDays
  ├─ Vue tableau : stats, filtres, recherche, changement de statut, paiement
  ├─ Alerte allergies (hasAllergies / allergies depuis patientProfiles)
  ├─ Export CSV de la vue courante (fichier .csv, séparateur « ; »)
  ├─ Nouveau RDV pour un patient sans compte (staffBookAppointment : fiche
  │   minimale créée à la volée — téléphone / sans rendez-vous)
  └─ Liste d'attente (staffWaitingList → assignWaitingSlot : attribution
      d'un créneau libéré au premier patient inscrit)
  └─ Vue calendrier (StaffCalendar) : semaine / mois, congés en ambre
StaffDoctors : fiches médecins + addDoctorOffDays / removeDoctorOffDays
  └─ Les congés ferment les créneaux : isDoctorOffDay dans computeAvailableSlots (catalog.ts)
```

### 4.6 Fonctionnalités v2 (liste d'attente, stats, équipe, journal, PDF, notifications)

```
Liste d'attente (patient)
  BookAppointment : « M'ajouter à la liste d'attente » quand plus aucun
  créneau n'est libre → joinWaitingList (waitingList.ts)
  MyAppointments : panneau « Liste d'attente » + retrait (leaveWaitingList)
  À l'annulation d'un RDV (cancelAppointment / updateAppointmentStatus) :
  notifyWaitingList → e-mail « Un créneau vient de se libérer » (emails.ts)

Statistiques (StaffStats + convex/stats.ts, recharts)
  getDashboardStats : CA par mois (6 mois), RDV par jour (30 j), statuts,
  activité par praticien — agrégation réactive, aucune table dénormalisée

Équipe (StaffAccounts + convex/staff.ts, P8)
  Comptes individuels : nom/e-mail + mot de passe (SHA-256 + sel), rôles
  admin / médecin / accueil. Seul un admin gère l'équipe ; le compte partagé
  (« admin123 ») garde le rôle admin. Connexion via le provider « staff »
  (identifier + password, ou mot de passe partagé si identifier vide).

Journal d'activité (StaffActivityLog + convex/log.ts)
  logActivity(ctx, { actorId, action, label, details }) insère une ligne
  activityLogs ; listActivityLogs (staff) renvoie les 100 dernières.

Notifications (NotificationBell + convex/notifications.ts)
  Cloche in-app pour patients et administration : myNotifications (non-lues
  d'abord), markRead (une ou toutes), create (actions). Générées par
  recordPayment (confirmation + rappels), cancelAppointment (annulation),
  sendSlotAvailable (créneau libéré) et bookAppointment (nouveau RDV →
  notifyAllStaff).

Reçu PDF (lib/receipt.ts, jsPDF)
  downloadAppointmentReceipt : reçu de paiement A4 (en-tête teal, montants
  FCFA, part assurance) — accessible depuis « Mes rendez-vous ».

Signes vitaux (MyRecord, recharts)
  VitalsChart : courbes poids / température / tension par visite.

Tests (Vitest)
  bun test : pricing.test.ts (computePatientShare) + clinic.test.ts
  (toDateKey, computeAge, formatVitalSigns, appointmentPrice, doctorWorksOn).
```

---

## 5. Règles de développement

- **Codegen d'abord** : après toute modification de `src/convex/`, lancer
  `bun convex dev --once` puis `bun tsc -b --noEmit`. Ne jamais éditer
  `src/convex/_generated/` à la main.
- **Auth côté serveur** : chaque query/mutation sensible vérifie le rôle
  (`requireUser`, `requireStaff`) via `getAuthUserId`.
- **Date** : clés locales `"yyyy-MM-dd"` / `"HH:mm"` (helpers dans
  `lib/clinic.ts` et `catalog.ts`).
- **Langue** : toute l'UI et les e-mails sont en français.
- **Monnaie** : FCFA, sans décimales (`formatPrice`).
