# RESUME — Clinic Bookings

> **À LIRE EN DÉBUT DE CHAQUE SESSION.** Ce fichier est la mémoire du projet :
> historique des demandes, décisions, fonctionnalités livrées, état des tests et
> conventions. Il est mis à jour à chaque étape importante. Consulter aussi
> `ARCHITECTURE.md` pour la vue technique détaillée.

---

## 1. Le projet

**Clinic Bookings** — site web de **prise de rendez-vous dans une clinique**,
en français, thème **Modern** (accent teal, neutres discrets, cartes arrondies,
typographie soignée).

**Périmètre V1** : gérer les rendez-vous. Deux utilisateurs principaux : les
**patients** (réservation en ligne) et l'**administration** (planning,
paiements, dossiers).

**Stack** : Vite + React 19 + TypeScript · Tailwind v4 + shadcn/ui · Convex
(backend/BDD) · Convex Auth · Elastic Email (e-mails) · Twilio (SMS) ·
CinetPay (paiements mobiles) · Bun · Vitest (tests).

**Langue de l'interface** : français (les messages utilisateur sont en FR).

---

## 2. Décisions et demandes utilisateur (historique)

1. **Compte sans fiche patient** → refusé : affichage d'un message, le compte
   n'est pas validé tant que la fiche n'est pas remplie. Les comptes orphelins
   créés pendant les tests ont été supprimés.
2. **« client » → « patient »** partout dans l'app.
3. **Connexion administration** : mot de passe partagé (`admin123`,
   configurable dans les paramètres) **et** comptes individuels (nom/e-mail +
   mot de passe).
4. **Deux personnes peuvent-elles avoir la même adresse e-mail ?** → traité :
   l'e-mail est l'identifiant de connexion (unique), la fiche patient est liée
   au compte.
5. **E-mails** : confirmation envoyée quand un rendez-vous est **confirmé**
   (paiement validé) + **rappel la veille (J-1, 24 h avant)** via
   `scheduler.runAt`.
6. **SMS et paiements mobiles** : **débloqués en mode démo (août 2026)** — les
   fonctions existent (Twilio + CinetPay) et s'activent dès que les clés API
   sont renseignées dans l'onglet « Keys » (voir §3 et §5).
7. **Liste des pistes d'amélioration (points 1→19)** : l'utilisateur a
   priorisé **2, 4, 5, 6, 7, 8, 9, 12, 15, 19** — tous implémentés (voir §3).
   Les autres points sont différés.
8. **Pistes suivantes demandées** : débloquer SMS/paiements (mode démo), puis
   **dossier enrichi**, **rappels multiples (J-7/J-3/J-1)** et **notifications
   in-app** — toutes livrées (voir §3).
9. **Renommage (août 2026)** : l'**espace Personnel** devient l'**espace
   Administration** partout dans l'app (onglet de connexion, titres, badge,
   messages d'erreur, docs). Le compte partagé s'appelle désormais
   « Administration de la clinique » (renommage idempotent pour les comptes
   existants). Les onglets patient (**Prendre rendez-vous**, **Mes rendez-vous**)
   sont **retirés du menu admin** — l'équipe arrive directement sur le
   Planning et réserve pour les patients via « Nouveau RDV » ; la réservation
   en ligne reste l'affaire de l'espace patient.

---

## 3. Fonctionnalités livrées (points prioritaires)

| # | Fonctionnalité | Où |
|---|---|---|
| **P2** | **Liste d'attente** + politique d'annulation gratuite jusqu'à 24 h | `waitingList.ts`, `BookAppointment`, `MyAppointments`, `StaffPlanning` |
| **P4** | **RDV pour un patient sans compte** (téléphone / walk-in) : fiche existante ou création minimale à la volée | `StaffPlanning` (StaffBookDialog), `staffBookAppointment` |
| **P5** | **Statistiques** (recharts) : CA 6 mois, RDV/30 j, statuts, activité par praticien | `StaffStats.tsx`, `convex/stats.ts` |
| **P6** | **Reçu PDF** des rendez-vous payés (design clinique, part assurance) | `src/lib/receipt.ts`, `MyAppointments` |
| **P7** | **Évolution des signes vitaux** (poids, température, tension) au fil des visites | `MyRecord.tsx` (VitalsChart) |
| **P8** | **Comptes de l'équipe multiples + rôles** (admin / médecin / accueil) : créer, changer le rôle, désactiver, reset mot de passe | `StaffAccounts.tsx`, `convex/staff.ts`, `convex/auth/staff.ts` |
| **P9** | **Alerte allergies** (badge ambre ⚠ + détail) dans le planning | `StaffPlanning.tsx`, champ `allergies` des fiches |
| **P12** | **Journal d'activité** (réservations, paiements, annulations, équipe) avec auteur + horodatage | `StaffActivityLog.tsx`, `convex/log.ts` |
| **P15** | **Tests automatisés Vitest** — voir §4 | `src/lib/*.test.ts` |
| **P19** | **Export CSV** du planning (vue filtrée, Excel FR : `;`, BOM, `"` doublés) | `StaffPlanning.tsx`, `src/lib/csv.ts` |

### Nouveautés (août 2026)

**🔔 Notifications in-app** — cloche dans le dashboard (patients **et**
administration), badge non-lues, liste déroulante, marquage lu / tout lire.
- Table `notifications` (`convex/notifications.ts` : `myNotifications`,
  `markRead`, `create`).
- Générées pour : confirmation de RDV, rappels J-7/J-3/J-1, annulation,
  créneau libéré (liste d'attente), **nouveau RDV en ligne → l'équipe est
  prévenue** (`notifyAllStaff` dans appointments.ts).

**🔁 Rappels multiples (J-7, J-3, J-1)** — `reminderScheduleTimes` dans
`src/lib/booking.ts` (pur, testé) : à la validation du paiement, `recordPayment`
programme **tous les rappels encore dans le futur** via `scheduler.runAt`
(le `daysBefore` est passé à l'action). Chaque rappel re-vérifie le statut à
l'envoi (jamais envoyé si annulé/terminé).

**💬 SMS (Twilio) — mode démo activable** — `convex/emails.ts` :
`sendViaTwilio` (REST Twilio, numéro normalisé E.164 via `toE164`, pur/testé).
Sans clés → `{ sent: false, reason: "no-key" }` + warning (le flux continue).
Les SMS partent avec la confirmation, les rappels et le créneau libéré, quand
le patient a un téléphone.

**📱 Paiements mobiles (CinetPay) — mode démo activable** — `convex/payments.ts` :
- `getIntegrationStatus` (query) : `{ email, sms, mobileMoney }` selon les clés.
- `createMobilePaymentRequest` (action) : calcul du reste à charge → demande
  CinetPay v2 (Orange Money / MTN MoMo / Wave) ; **sans clé → mode démo**
  (réf. + montant + message, lien factice). Journalisé.
- `recordMobilePayment` (mutation) : confirmer le RDV une fois le paiement
  mobile encaissé.
- UI : dialogue de paiement du planning → section « Paiement mobile » (badge
  Actif / Mode démo, demande au téléphone du patient, lien de paiement).

**📋 Dossier enrichi** — fiche patient + comptes rendus approfondis :
- `patientProfiles` : **groupe sanguin**, antécédents **familiaux**,
  **chirurgicaux**, **traitements en cours** (schéma + `createProfile` /
  `updateProfile` / `updateMedicalInfo`).
- `visits` : **diagnostic**, **conseils / conduite à tenir**, **prochaine
  consultation** (schéma + `addVisit`, affichés dans `VisitCard`).
- UI : `PatientProfileForm`, `MyRecord` (affichage + édition), `StaffPatients`
  (fiche médicale + nouvelle visite).

**E-mails (déjà actifs)** : confirmation à la validation du paiement
(`recordPayment`), **rappel J-1** (exactement 24 h avant, statut re-vérifié à
l'envoi), e-mail « un créneau s'est libéré » au premier patient de la liste
d'attente à chaque annulation. Fournisseur : **Elastic Email** (action
`api.emails.*`).

---

## 4. Tests (Vitest) — état : 158 pass / 0 fail

Logique métier extraite dans des **modules purs `src/lib/`** (sans import Convex)
pour être testable — les mutations/queries Convex délèguent à ces fonctions, les
tests couvrent donc **exactement** le code exécuté.

| Fichier | Couvre |
|---|---|
| `booking.test.ts` | Annulation 24 h, FIFO liste d'attente, **rappel J-1** (`reminderScheduleTime`), **rappels multiples** (`reminderScheduleTimes` : J-7/J-3/J-1, filtrage des délais passés, borne exacte), **normalisation SMS** (`toE164`), validation des dates, non-doublon d'inscription, **numéros de dossier** (`nextDossierNumber` : D-000x, plage démo D-900x ignorée, pas de réutilisation) |
| `clinic.test.ts` | Formats de date, âge, constantes vitales, tarifs, jours travaillés |
| `pricing.test.ts` | Part patient / assurance (tiers payant, taux, arrondi FCFA) |
| `slots.test.ts` | Créneaux disponibles : congés (plage inclusive), horaires fiche/default, chevauchements, créneaux passés masqués |
| `stats.test.ts` | Agrégation du dashboard : buckets mois/jours, ordre du jour, statuts, CA par praticien |
| `csv.test.ts` | Formatage CSV (cellules, séparateur `;`, BOM, en-tête), filtres du planning (`filterAppointments`/`searchAppointments`), tri (`sortAppointments` stable), **tri vue calendrier** (`groupAppointmentsByDate`) |
| `password.test.ts` | Hachage des mots de passe de l'équipe : SHA-256 (vecteur RFC), sel aléatoire 128 bits unique, aller-retour, rejet du mauvais mot de passe, sel/hash manquants |

**Commande** : `bun test`

---

## 5. Conventions importantes (à respecter)

- **Vérification systématique après modif Convex** : `bunx convex dev --once`
  (codegen) puis `bun tsc -b --noEmit`. Pour le front seul : `bun tsc -b --noEmit`.
  Ne jamais éditer `src/convex/_generated/*` à la main.
- **Logique pure → `src/lib/`** : toute règle métier dupliquée ou testable va
  dans un module `src/lib/*.ts` **sans dépendance** (ni `@/` alias, ni imports
  Convex — sinon la chaîne de compilation Convex casse ; cf. le cas
  `slots.ts`/`clinic.ts`). Les fichiers Convex l'importent en relatif
  (`../lib/...`).
- **Tests** : `src/lib/*.test.ts`, style `describe/it` avec fixtures
  déterministes ; tester les cas limites (bordures 24 h, dates impossibles,
  stabilité des tris, entrées non mutées).
- **Ne pas modifier** : `vite.config.ts` (HMR désactivé requis), `.env`
  (secrets via l'UI Keys), `vly-toolbar-readonly.tsx`.
- **Backend** : Convex uniquement (queries réactives, mutations, scheduler,
  actions « use node » pour les clés `process.env`). Ne pas ajouter d'autre
  backend sans demande explicite.
- **Actions Convex** : pas de `ctx.db` direct → lire via `ctx.runQuery` sur des
  queries internes sans session (id non devinable), écrire via
  `ctx.runMutation` (ex. `api.notifications.create`,
  `api.payments.recordPaymentActivity`).
- **Référence circulaire `api`** : annoter explicitement les types de retour
  des handlers qui appellent `api.*` de leur propre module (même convention
  que `seedDemo.ts`).
- **UI** : composants shadcn/ui + Tailwind existants, thème teal « Modern »,
  texte FR.

---

## 6. Clés d'intégration (onglet « Keys » de Freebuff)

| Canal | Variables | Sans clé |
|---|---|---|
| E-mail | `ELASTICEMAIL_API_KEY` | e-mail non envoyé (warning) |
| SMS | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | SMS non envoyé (warning) — **mode démo** |
| Paiement mobile | `CINETPAY_API_KEY`, `CINETPAY_SITE_ID` | **mode démo** dans le dialogue de paiement |

Les notifications in-app fonctionnent **toujours** (aucune clé requise).

## 7. Pistes restantes (non priorisées par l'utilisateur)

- **Activer réellement SMS + paiements mobiles** : dès que l'utilisateur
  fournit les clés (Twilio, CinetPay) → les coller dans l'onglet « Keys »,
  vérifier les envois. Le code est déjà prêt (mode démo → mode réel).
- Autres points d'amélioration 1, 3, 10, 11, 13, 14, 16, 17, 18 (multi-clinique,
  rappels à la carte, notifications multi-canaux avancées…).
- Déployer/publier, régler les secrets dans l'UI Keys.

---

## 8. Revue générale du code (août 2026)

Revue complète effectuée (backend Convex, pages, auth, libs, composants) :
- **Corrigé** : `Dashboard.tsx` dupliquait `initials()` sans retirer « Dr » — il
  réutilise désormais `clinic.ts` (avatars cohérents « AK » pour « Dr Aya Koné »).
- **Extrait** : hachage des mots de passe → `src/lib/password.ts` (pur, Web
  Crypto), `convex/staff.ts` délègue — logique sensible désormais testée.
- **Commentaire** `schema.ts` : prix en FCFA (pas en euros).
- Flux auth (RequireAuth → `/auth?returnTo=…` → `/dashboard`) cohérent.

### Revue n° 2 (août 2026) — bugs corrigés

Nouvelle revue complète : tests + typecheck + codegen OK, puis corrections :
- **`updateAppointmentStatus`** effaçait `amountPaid`/`paidAt` quand un RDV
  **payé** passait « Terminé » → perte des stats CA, du reçu et de
  l'encaissé affiché. Désormais le paiement est **conservé** pour
  « Terminé » (uniquement remis à zéro vers pending/annulé, ex. remboursement).
- **`recordMobilePayment`** (paiement mobile confirmé) ne déclenchait ni
  confirmation e-mail/SMS/notification in-app ni rappels J-7/J-3/J-1 —
  incohérent avec `recordPayment`. Désormais identique (scheduler).
- **`createDoctor`** rejetait tout second médecin partageant un **prénom**
  (`q.eq(q.field("firstName"), firstName)`) — vérification réduite au nom
  complet « Dr Prénom Nom ».
- **`allAppointments`** affichait « Patient » pour les comptes créés par code
  e-mail (OTP) ou invités (`users.name` vide) — le planning utilise
  désormais le **nom de la fiche patient** (prénom + nom) et son e-mail.
- **`updateProfile`** ne vérifiait pas l'**unicité de l'e-mail** de la fiche
  (contrairement à `createProfile`) — même garde ajoutée (deux fiches ne
  peuvent jamais partager la même adresse).
- **Numéros de dossier** : `count + 1` → **`nextDossierNumber`**
  (dans `lib/booking.ts`, testé) : max existant + 1, plage démo D-900x
  ignorée, jamais de réutilisation après suppression.
- **`assignWaitingSlot`** n'envoyait que l'e-mail — ajout de `userId` et du
  téléphone pour la **notification in-app + SMS** (multi-canaux cohérents).
- **UI** : écran de succès de réservation affichait l'heure **en double**
  (« 09:30 – 09:30 – 10:00 ») → `formatTimeRange` avec la durée du service ;
  texte « paiement mobile bientôt disponible » → **disponible** (Orange
  Money / MTN MoMo / Wave) ; le menu de statut du planning affiche
  désormais « Confirmé » (item désactivé) au lieu d'un champ vide.
- **Résilience aperçu** : ajout d'un bouton **« Recharger la page »** sur
  l'écran d'erreur (`RootErrorBoundary` dans `main.tsx`) avec un message
  adapté — corrige les « Failed to fetch dynamically imported module »
  transitoires quand le serveur d'aperçu de la plateforme redémarre (le code
  n'est pas en cause : typecheck + tests verts).

### Revue n° 3 (août 2026) — espace Administration

Renommage demandé par l'utilisateur : **« Espace Personnel » → « Espace
Administration »** + réponse à la question « Prendre rendez-vous pour qui ? »
→ flux **patient** retiré du menu admin.

- **UI** : onglet de connexion « Personnel » → « Administration » ; titres
  « Espace personnel » → « Espace administration » (Auth, Dashboard) ; badge
  de rôle « Personnel » → « Administration » ; rubriques « Équipe »
  (StaffAccounts, VIEW_META) reformulées en « membres de l'équipe » ; liens
  et raccourcis (Landing footer, page de connexion, RoleGate) alignés.
- **Menu admin allégé** : les onglets patient « Prendre rendez-vous » et
  « Mes rendez-vous » sont retirés de la navigation des comptes staff — le
  défaut devient le **Planning** (effet de redirection si une vue patient
  était active). La réservation en ligne reste dans l'espace patient ;
  l'équipe réserve pour un patient reçu par téléphone via
  **Planning → Nouveau RDV** (`staffBookAppointment`).
- **Backend** : messages d'erreur « Accès réservé au personnel de la
  clinique » → « …à l'administration de la clinique » (tous les modules) ;
  libellés du journal (« Créé par l'administration », « Membre de l'équipe
  créé », …) ; nom du compte partagé « Personnel de la clinique » →
  « Administration de la clinique » avec **renommage idempotent**
  (`refreshSharedStaffAccountName`, appliqué à chaque connexion du compte
  partagé pour rattraper les déploiements existants).
- **Docs** : README.md, ARCHITECTURE.md et RESUME.md alignés.
- **Menu latéral escamotable** : bouton « Masquer le menu » / « Afficher le
  menu » dans la barre du haut (écrans ≥ lg) qui replie la barre latérale
  (largeur animée 300 ms) pour libérer l'espace du contenu — la navigation
  mobile (pastilles) reste inchangée.
- **Coupure de connexion (bannière + pastille)** : `useConnection`
  (`src/hooks/use-connection.ts`) combine `navigator.onLine` (réseau du
  navigateur) et l'état WebSocket Convex (`connectionState()` /
  `subscribeToConnectionState`, « reconnecting » seulement après une première
  connexion pour éviter le flash au démarrage). UI : **bannière flottante**
  « Connexion perdue — reconnexion automatique… » (globale, `main.tsx`) et
  **pastille** verte/ambre/rouge dans le dashboard (barre latérale, top bar
  desktop, header mobile). Aucune donnée n'est perdue : le client Convex se
  reconnecte et re-synchronise automatiquement ; les actions échouées sont
  annulées (mutations atomiques).

## 9. Dernier état vérifié

- `bun test` → **158 pass / 0 fail** (286 expect) · 7 fichiers
- `bunx convex dev --once` → OK (fonctions prêtes)
- `bun tsc -b --noEmit` → OK (aucune erreur)
- **Erreur d'aperçu transitoire** : « Failed to fetch dynamically imported
  module » (ex. `src/pages/Auth.tsx`) = serveur d'aperçu de la plateforme en
  cours de redémarrage, **pas** un bug de code — recharge de la page
  (ou bouton « Recharger » ajouté sur l'écran d'erreur) pour récupérer.
- **Zip régénéré** : `clinic-bookings-src.zip` + `public/clinic-bookings-src.zip`
  (hors `node_modules`/`.git`/`dist`/`.convex`/`*.zip`).
  Commande : `zip -r clinic-bookings-src.zip . -x "node_modules/*" -x ".git/*"
  -x "dist/*" -x ".convex/*" -x "*.zip"` puis copie dans `public/`.

## 10. Session infra (9 août 2026) — Git, dépendances, Convex, Vercel

Aucun changement de code métier cette session : uniquement de l'infra
(dépôt Git, déploiement Convex, préparation Vercel). À reprendre à la
prochaine session.

1. **Dépôt Git initialisé** localement (le dossier n'était pas un repo) et
   poussé sur **https://github.com/yyracine/ClinicBooking** (branche `main`).
   Le remote contenait déjà un ancien commit « première version » (sans les
   fonctionnalités v2) → **écrasé volontairement** (force push, confirmé par
   l'utilisateur) par le commit local complet et à jour.
2. **`CLAUDE.md` créé** à la racine (guidage pour Claude Code : commandes,
   architecture, conventions) — complète `ARCHITECTURE.md` sans le dupliquer.
3. **Bug d'installation trouvé et corrigé** : `node_modules/` n'existait pas
   du tout (`bun install` jamais lancé) → `bunx convex dev` échouait avec
   `[ERROR] Could not resolve "convex/server"`. Corrigé par `bun install`.
4. **⚠️ Déploiement Convex changé** : l'ancien `.env.local` pointait vers
   `whimsical-crane-613`, un déploiement qui **n'appartenait pas à ce
   projet** (vérifié : ses fonctions `seed`/`demo` répondaient avec un schéma
   multi-clinique fantôme — `clinics`, `doctorCountA/B` — absent du code
   actuel ; `catalog:listServices`/`listDoctors` y restaient vides). Après
   connexion de l'utilisateur (`bunx convex dev`), un **nouveau déploiement
   légitime a été provisionné** :
   - Team `yao-racine`, projet `clinicbooking`, déploiement dev
     **`silent-cobra-790`**.
   - `.env.local` mis à jour automatiquement (`VITE_CONVEX_URL`,
     `CONVEX_DEPLOYMENT`, `VITE_CONVEX_SITE_URL`).
   - Vérifié : `seedDemo:seedDemoData` renvoie bien la forme attendue par le
     code actuel (`patients:3, visits:7, appointments:3`), `catalog:listServices`
     et `listDoctors` retournent les données de démo.
5. **Connexion démo impossible → corrigé** : le nouveau déploiement n'avait
   pas les clés Convex Auth (`JWT_PRIVATE_KEY`, `JWKS`) → l'endpoint
   `/.well-known/jwks.json` renvoyait `Missing environment variable "JWKS"`
   (500), donc **aucune connexion** (démo ou autre) ne pouvait fonctionner.
   Corrigé sans passer par l'assistant interactif `@convex-dev/auth` (qui
   réécrit du code) : paire de clés RS256 générée localement avec `jose`,
   poussée avec `bunx convex env set JWT_PRIVATE_KEY/JWKS --from-file`.
   Connexion démo (`demo@clinic-bookings.local` / `demo1234`) **vérifiée OK**
   par l'utilisateur.
6. **`vercel.json` ajouté** (commité et poussé) pour préparer le déploiement
   sur Vercel :
   - `rewrites` : fallback SPA (le routeur est un `BrowserRouter` avec de
     vraies routes `/auth`, `/dashboard` — sans ce fallback, un rafraîchissement
     renvoie 404 sur Vercel).
   - `buildCommand: "bunx convex deploy --cmd 'bun run build'"` : déploie les
     fonctions Convex vers la **prod** puis build le frontend, en injectant
     automatiquement `VITE_CONVEX_URL`/`VITE_CONVEX_SITE_URL` de prod.
   - `installCommand: "bun install"` (explicite car le repo a `bun.lock`
     **et** `package-lock.json` — évite toute ambiguïté de détection Vercel).

### Déploiement Vercel — terminé (10 août 2026)

**Prod en ligne : https://clinic-booking-ashen.vercel.app**

1. Projet Vercel créé (import `yyracine/ClinicBooking`, équipe
   `assables-projects`, nom de projet `clinic-booking`).
2. `CONVEX_DEPLOY_KEY` (déploiement prod `disciplined-stingray-549`) générée
   côté Convex et ajoutée en variable d'env Vercel — **scope "Production"
   uniquement** (jamais "Preview", sinon chaque preview de PR redéploierait
   vers la prod Convex).
3. Secrets poussés sur Convex `--prod` :
   - `JWT_PRIVATE_KEY` / `JWKS` : **nouvelle paire RS256** générée avec
     `jose` (dédiée à la prod, différente de celle du dev), poussée via
     `bunx convex env set NAME --from-file fichier --prod`.
   - `VLY_CONVEX_AUTH_ISSUER=https://freebuff.com` : requis par
     `auth.config.ts` (le CLI Convex exige que toute variable référencée
     dans `auth.config.ts` soit explicitement définie sur le déploiement,
     même si le code a un `?? "fallback"` JS) — même valeur que le dev.
4. **Bug de build corrigé** : `vercel.json` faisait
   `bunx convex deploy --cmd 'bun run build'`. Or `convex deploy --cmd`
   exécute la commande **avant** de régénérer `convex/_generated/` (ordre
   documenté par `convex deploy --help` : cmd → typecheck → codegen →
   bundle → push). Comme `_generated/` est gitignored (jamais committé) et
   que `bun run build` fait `tsc -b && vite build`, le typecheck échouait
   systématiquement sur un checkout neuf (« Cannot find module
   `./_generated/...` »). **Fix** : `buildCommand` devient
   `bunx convex codegen && bunx convex deploy --cmd 'bun run build'`
   (`convex codegen` régénère `_generated/` localement, sans push, avant le
   build).
5. **Intégration GitHub → Vercel non fonctionnelle** : un push sur `main`
   après le fix ci-dessus n'a déclenché aucun nouveau build (webhook/accès
   repo pas complètement configuré côté Vercel). Contournement : CLI Vercel
   (`bunx vercel link` puis `bunx vercel --prod`) pour déployer directement
   depuis le poste local — a fonctionné du premier coup après le fix #4.
   **Reste à faire** : vérifier `Settings → Git` sur le projet Vercel pour
   rebrancher le déploiement automatique sur push (sinon chaque changement
   futur doit être déployé manuellement via `bunx vercel --prod`).
6. **Données de démo semées en prod** :
   `bunx convex run seedDemo:seedDemoData --prod` (action publique, pas de
   garde d'auth — même commande qu'en dev). Résultat :
   `patients:3, visits:7, appointments:3`.
7. **Vérifié de bout en bout** (navigateur) : landing page, page `/auth`,
   connexion avec le compte démo (`demo@clinic-bookings.local` /
   `demo1234`) → dashboard patient chargé avec les services et l'historique.

**Reste optionnel** : `ELASTICEMAIL_API_KEY` / `TWILIO_*` / `CINETPAY_*` ne
sont pas poussés sur la prod (l'app tourne en mode démo pour ces canaux,
comme en dev) — à faire si on veut les emails/SMS/paiements mobiles réels
en production.
