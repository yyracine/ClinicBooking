# 🏥 Clinic Bookings

Plateforme de prise de rendez-vous en ligne pour une clinique. Les patients choisissent un service, un praticien et un créneau ; l'équipe gère le planning, les paiements et les dossiers médicaux.

## ✨ Fonctionnalités

### Côté patient
- **Inscription & connexion** : par code par e-mail (OTP), par mot de passe, ou en invité
- **Prise de rendez-vous** : recherche de service, choix du praticien, calendrier avec créneaux calculés selon les jours et heures de vacation des médecins
- **Fiche patient** : nom, prénom, date de naissance, âge, téléphone, contact d'urgence, adresse, e-mail, informations d'assurance (assureur, taux de remboursement, tiers payant)
- **Dossier médical** : comptes rendus des consultations (médecin, date, rapport), médicaments prescrits avec posologie, examens avec résultats commentés — **téléchargeable en PDF**
- **Mon espace** : liste des rendez-vous, annulation, consultation et édition partielle de la fiche patient

### Côté administration (mot de passe partagé)
- **Tableau de bord planning** : tous les rendez-vous dans un tableau, validation des paiements → le statut passe automatiquement à « Confirmé » (montant calculé selon l'assurance du patient, en FCFA sans décimales)
- **Fiche médecin** : nom, prénom(s), spécialité, téléphone,  jours et heures de vacation — gérée par l'équipe, pilote les créneaux proposés aux patients
- **Patients** : recherche, fiches patient et dossiers médicaux complets
- **Mot de passe** : modifiable après la période de test

## 🔑 Accès de démonstration

| Rôle | Accès |
|---|---|
| Patient démo | `demo@clinic-bookings.local` / `demo1234` (dossier D-9001 avec visites, médicaments et examens) |
| Administration | Onglet « Administration » de la page de connexion, mot de passe : `admin123` |

Des données fictives (3 patients avec dossiers médicaux complets, médecins avec plannings, rendez-vous) sont insérées automatiquement au premier chargement — sans risque pour vos vraies données (insertion idempotente).

## 🛠️ Stack technique

- **Frontend** : Vite · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Lucide · Framer Motion
- **Backend & base de données** : Convex (queries, mutations, actions)
- **Authentification** : Convex Auth (OTP e-mail, mot de passe, invité, administration)
- **PDF** : jsPDF (téléchargement du dossier médical)
- **Gestionnaire de paquets** : Bun

## 🚀 Installation locale

```bash
# 1. Cloner le dépôt puis installer les dépendances
bun install

# 2. Démarrer la base de données Convex (crée un déploiement de dev local)
bunx convex dev

# 3. Lancer l'application
bun run dev
```

## 🌱 Variables d'environnement

Copiez `.env.example` vers `.env.local` et renseignez les valeurs Convex :

```bash
cp .env.example .env.local
```

Les variables Convex (`CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`) sont générées par `bunx convex dev`. Les clés d'authentification (JWKS, JWT_PRIVATE_KEY, SITE_URL) sont configurées côté serveur Convex.

> ⚠️ **Sécurité** : `.env.local` contient vos clés. Il est exclu du dépôt par `.gitignore` — ne le commitez jamais.

## 📁 Structure du projet

```
src/
├── convex/            # Backend Convex
│   ├── schema.ts      # Schéma de la base de données
│   ├── auth/          # Providers d'authentification (OTP, administration)
│   ├── appointments.ts# Rendez-vous, paiements, statuts
│   ├── records.ts     # Fiches patient, dossiers médicaux
│   ├── doctors.ts     # Fiches médecins et plannings
│   ├── catalog.ts     # Services, disponibilités, créneaux
│   ├── seed.ts        # Données initiales (médecins, services)
│   └── demo.ts        # Données de démonstration (patients, visites)
├── components/
│   ├── dashboard/     # Espaces patient et administration
│   └── ui/            # Composants shadcn/ui
├── pages/             # Landing, connexion, dashboard, 404
├── hooks/             # useAuth, useIsMobile
└── lib/               # Helpers métier (formatage, prix, PDF)
```

## 📄 Scripts utiles

| Commande | Description |
|---|---|
| `bun run dev` | Serveur de développement |
| `bun run build` | Compilation de production |
| `bun run lint` | Analyse statique ESLint |
| `bunx convex dev` | Codegen Convex + déploiement local |

---

Fait avec soin pour votre santé. 💚
