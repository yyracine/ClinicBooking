# Tarification de la consultation par catégorie — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le prix de consultation « tapé librement par médecin » par une grille tarifaire à 4 catégories (généraliste/spécialiste × médecin/professeur) gérée par l'administration, tout en gardant un tarif exceptionnel possible par médecin, et retirer l'affichage du prix de la page d'accueil publique.

**Architecture:** Une fonction pure `resolveConsultationPrice()` (`src/lib/pricing.ts`) centralise la règle de calcul (override médecin > grille > prix du service) ; elle est appelée depuis les mutations Convex qui fixent un montant (`recordPayment`, `recordMobilePayment`, `getAppointmentPaymentInfo`) et depuis les composants React qui affichent un prix avant paiement. La grille elle-même est une ligne JSON dans la table `clinicSettings` existante (même pattern que le mot de passe partagé), exposée via une query/mutation dédiées dans `convex/settings.ts`.

**Tech Stack:** Convex (schema/queries/mutations), React 19 + TypeScript, Vitest pour la logique pure, Tailwind + shadcn/ui pour l'UI.

## Global Constraints

- Texte UI et messages d'erreur en **français**.
- Montants FCFA, **sans décimales**, formatés avec `formatPrice` (`src/lib/clinic.ts`).
- Logique métier testable → modules purs dans `src/lib/*.ts`, **sans import Convex ni alias `@/`** (les fichiers Convex les importent en relatif `../lib/...`).
- Après toute modification sous `src/convex/`, régénérer les types avant de continuer : `bunx convex dev --once` puis `bun tsc -b --noEmit`.
- Ne jamais éditer `src/convex/_generated/*` à la main.
- Chaque mutation Convex sensible vérifie le rôle `staff` côté serveur (`requireStaff`/vérification `user?.role !== "staff"`), ne pas se fier au frontend seul.
- Ne pas modifier `vite.config.ts`, `.env`, `vly-toolbar-readonly.tsx`.

---

### Task 1: Fonction pure de résolution du prix (`src/lib/pricing.ts`)

**Files:**
- Modify: `src/lib/pricing.ts`
- Test: `src/lib/pricing.test.ts`

**Interfaces:**
- Produces: `AcademicRank = "medecin" | "professeur"`, `PricingGrid { generalisteMedecin: number; generalisteProfesseur: number; specialisteMedecin: number; specialisteProfesseur: number }`, `DEFAULT_PRICING_GRID: PricingGrid`, `resolveConsultationPrice(doctor: { consultationPrice?: number; academicRank?: AcademicRank }, service: { price: number; isGeneralist?: boolean }, grid: PricingGrid | null | undefined): number`. Ces exports sont consommés par les tasks 3, 4, 6, 7, 8, 9.

- [ ] **Step 1: Écrire les tests (ils doivent échouer — la fonction n'existe pas encore)**

Ajoute au sommet de `src/lib/pricing.test.ts`, remplace la ligne d'import existante :

Ancien :
```ts
import { describe, expect, it } from "vitest";
import { computePatientShare } from "./pricing";
```

Nouveau :
```ts
import { describe, expect, it } from "vitest";
import {
  computePatientShare,
  resolveConsultationPrice,
  type PricingGrid,
} from "./pricing";
```

Puis ajoute ce nouveau bloc à la fin du fichier (après le dernier `describe("computePatientShare", ...)`) :

```ts
describe("resolveConsultationPrice", () => {
  const GRID: PricingGrid = {
    generalisteMedecin: 10000,
    generalisteProfesseur: 15000,
    specialisteMedecin: 20000,
    specialisteProfesseur: 30000,
  };

  it("généraliste + médecin (grade par défaut)", () => {
    expect(
      resolveConsultationPrice({}, { price: 5000, isGeneralist: true }, GRID),
    ).toBe(10000);
  });

  it("généraliste + professeur", () => {
    expect(
      resolveConsultationPrice(
        { academicRank: "professeur" },
        { price: 5000, isGeneralist: true },
        GRID,
      ),
    ).toBe(15000);
  });

  it("spécialiste + médecin (isGeneralist absent = spécialiste)", () => {
    expect(resolveConsultationPrice({}, { price: 5000 }, GRID)).toBe(20000);
  });

  it("spécialiste + professeur", () => {
    expect(
      resolveConsultationPrice(
        { academicRank: "professeur" },
        { price: 5000, isGeneralist: false },
        GRID,
      ),
    ).toBe(30000);
  });

  it("le tarif personnalisé du médecin prime toujours sur la grille", () => {
    expect(
      resolveConsultationPrice(
        { consultationPrice: 99000, academicRank: "professeur" },
        { price: 5000, isGeneralist: true },
        GRID,
      ),
    ).toBe(99000);
  });

  it("retombe sur le prix du service quand la grille est absente", () => {
    expect(resolveConsultationPrice({}, { price: 12000 }, null)).toBe(12000);
    expect(resolveConsultationPrice({}, { price: 12000 }, undefined)).toBe(
      12000,
    );
  });

  it("retombe sur le prix du service si une cellule de la grille est manquante", () => {
    const partial = { ...GRID, specialisteMedecin: undefined } as never;
    expect(resolveConsultationPrice({}, { price: 7000 }, partial)).toBe(7000);
  });
});
```

- [ ] **Step 2: Lancer les tests pour confirmer l'échec**

Run: `bun test src/lib/pricing.test.ts`
Expected: FAIL — `resolveConsultationPrice is not a function` (ou erreur d'import).

- [ ] **Step 3: Implémenter la fonction**

Ajoute à la fin de `src/lib/pricing.ts` (après `computePatientShare`) :

```ts
export type AcademicRank = "medecin" | "professeur";

/** La grille tarifaire à 4 catégories de la clinique (FCFA). */
export interface PricingGrid {
  generalisteMedecin: number;
  generalisteProfesseur: number;
  specialisteMedecin: number;
  specialisteProfesseur: number;
}

/** Valeurs de secours tant que l'administration n'a pas configuré sa grille. */
export const DEFAULT_PRICING_GRID: PricingGrid = {
  generalisteMedecin: 10000,
  generalisteProfesseur: 15000,
  specialisteMedecin: 20000,
  specialisteProfesseur: 30000,
};

/**
 * Prix effectif d'une consultation pour un couple médecin + service.
 *
 * 1. `doctor.consultationPrice` renseigné → tarif exceptionnel, prime
 *    toujours (ex. médecin sollicité pour une intervention particulière).
 * 2. Sinon, recherche dans `grid` selon la catégorie (service.isGeneralist ×
 *    grade du médecin).
 * 3. Sinon (grille absente ou cellule manquante) → prix du service, pour
 *    qu'une consultation ne se retrouve jamais à 0 FCFA par accident.
 */
export function resolveConsultationPrice(
  doctor: { consultationPrice?: number; academicRank?: AcademicRank },
  service: { price: number; isGeneralist?: boolean },
  grid: PricingGrid | null | undefined,
): number {
  if (doctor.consultationPrice != null) return doctor.consultationPrice;
  if (grid) {
    const rank = doctor.academicRank ?? "medecin";
    const key: keyof PricingGrid = service.isGeneralist
      ? rank === "professeur"
        ? "generalisteProfesseur"
        : "generalisteMedecin"
      : rank === "professeur"
        ? "specialisteProfesseur"
        : "specialisteMedecin";
    const value = grid[key];
    if (value != null) return value;
  }
  return service.price;
}
```

- [ ] **Step 4: Lancer les tests pour confirmer le succès**

Run: `bun test src/lib/pricing.test.ts`
Expected: PASS — tous les tests de `resolveConsultationPrice` et de `computePatientShare` passent.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing.ts src/lib/pricing.test.ts
git commit -m "feat: add category-based consultation pricing resolver"
```

---

### Task 2: Schéma — `isGeneralist` sur les services, `academicRank` sur les médecins

**Files:**
- Modify: `src/convex/schema.ts`

**Interfaces:**
- Consumes: rien.
- Produces: le champ `services.isGeneralist?: boolean` et `doctors.academicRank?: "medecin" | "professeur"`, utilisés par toutes les tasks suivantes qui lisent/écrivent des documents `services`/`doctors`.

- [ ] **Step 1: Ajouter `isGeneralist` à la table `services`**

Dans `src/convex/schema.ts`, remplace :

```ts
    // Medical services offered by the clinic (ex: cardiologie, dentisterie...)
    services: defineTable({
      name: v.string(), // service name (fr)
      description: v.string(), // short description (fr)
      durationMinutes: v.number(), // duration of a consultation
      price: v.number(), // price in FCFA
      icon: v.string(), // lucide icon key used on the frontend
      color: v.string(), // tint key used on the frontend
    }),
```

par :

```ts
    // Medical services offered by the clinic (ex: cardiologie, dentisterie...)
    services: defineTable({
      name: v.string(), // service name (fr)
      description: v.string(), // short description (fr)
      durationMinutes: v.number(), // duration of a consultation
      price: v.number(), // price in FCFA
      icon: v.string(), // lucide icon key used on the frontend
      color: v.string(), // tint key used on the frontend
      // true uniquement pour "Médecine générale" — pilote la grille
      // tarifaire (voir src/lib/pricing.ts). Absent/false = spécialiste.
      isGeneralist: v.optional(v.boolean()),
    }),
```

- [ ] **Step 2: Ajouter `academicRank` à la table `doctors`**

Dans le même fichier, remplace :

```ts
      consultationPrice: v.optional(v.number()), // price of one consultation, FCFA (no decimals)
```

par :

```ts
      consultationPrice: v.optional(v.number()), // price of one consultation, FCFA (no decimals) — tarif EXCEPTIONNEL qui prime sur la grille (voir src/lib/pricing.ts)
      // Grade académique — combiné à services.isGeneralist pour la grille
      // tarifaire. Absent = "medecin" (médecins créés avant ce champ).
      academicRank: v.optional(
        v.union(v.literal("medecin"), v.literal("professeur")),
      ),
```

- [ ] **Step 3: Régénérer les types et vérifier**

Run: `bunx convex dev --once`
Expected: `Schema validated`, pas d'erreur.

Run: `bun tsc -b --noEmit`
Expected: aucune erreur (le schéma seul ne casse aucun call site existant, les deux champs sont optionnels).

- [ ] **Step 4: Commit**

```bash
git add src/convex/schema.ts
git commit -m "feat: add isGeneralist (services) and academicRank (doctors) fields"
```

---

### Task 3: Intégration dans `src/lib/clinic.ts` (`appointmentPrice`)

**Files:**
- Modify: `src/lib/clinic.ts`
- Test: `src/lib/clinic.test.ts`

**Interfaces:**
- Consumes: `PricingGrid`, `AcademicRank`, `resolveConsultationPrice` (Task 1, `@/lib/pricing`).
- Produces: `appointmentPrice(a: AppointmentWithDetails, grid?: PricingGrid | null): number` — nouvelle signature à 2 paramètres, consommée par les tasks 8 et 9 (StaffDoctors, BookAppointment, MyAppointments, StaffPlanning, AppointmentCard).

- [ ] **Step 1: Mettre à jour les tests existants et en ajouter un nouveau**

Dans `src/lib/clinic.test.ts`, remplace le bloc `describe("appointmentPrice", ...)` (lignes 51-69) par :

```ts
describe("appointmentPrice", () => {
  it("prefers the tariff set on the doctor fiche", () => {
    expect(
      appointmentPrice({
        doctor: { consultationPrice: 30000 },
        service: { price: 20000 },
      } as never),
    ).toBe(30000);
  });

  it("falls back to the service price without a grid", () => {
    expect(
      appointmentPrice({
        doctor: {},
        service: { price: 20000 },
      } as never),
    ).toBe(20000);
  });

  it("uses the pricing grid category when provided", () => {
    const grid = {
      generalisteMedecin: 10000,
      generalisteProfesseur: 15000,
      specialisteMedecin: 20000,
      specialisteProfesseur: 30000,
    };
    expect(
      appointmentPrice(
        {
          doctor: { academicRank: "professeur" },
          service: { price: 5000, isGeneralist: false },
        } as never,
        grid,
      ),
    ).toBe(30000);
  });

  it("returns 0 when the doctor or service is missing", () => {
    expect(appointmentPrice({ doctor: null, service: null } as never)).toBe(
      0,
    );
  });
});
```

- [ ] **Step 2: Lancer les tests pour confirmer l'échec sur le nouveau cas**

Run: `bun test src/lib/clinic.test.ts`
Expected: FAIL sur "uses the pricing grid category when provided" (la fonction ignore encore la grille) ; les deux premiers tests passent déjà (comportement inchangé).

- [ ] **Step 3: Mettre à jour `AppointmentWithDetails` et `appointmentPrice`**

Dans `src/lib/clinic.ts`, remplace la ligne d'import de tête :

Ancien :
```ts
import type { InsuranceLike } from "@/lib/pricing";
```

Nouveau :
```ts
import {
  resolveConsultationPrice,
  type AcademicRank,
  type InsuranceLike,
  type PricingGrid,
} from "@/lib/pricing";
```

Puis remplace l'interface `AppointmentWithDetails` :

Ancien :
```ts
export interface AppointmentWithDetails {
  _id: Id<"appointments">;
  date: string;
  time: string;
  status: AppointmentStatus;
  notes?: string;
  amountPaid?: number;
  paidAt?: number;
  doctor: {
    name: string;
    title: string;
    color: string;
    /** Consultation price set on the doctor's fiche (FCFA). */
    consultationPrice?: number;
  } | null;
  service: {
    name: string;
    durationMinutes: number;
    price: number;
    icon: string;
    color: string;
  } | null;
}

/** Effective price of an appointment: the doctor's tariff, else the service's. */
export function appointmentPrice(a: AppointmentWithDetails): number {
  return a.doctor?.consultationPrice ?? a.service?.price ?? 0;
}
```

Nouveau :
```ts
export interface AppointmentWithDetails {
  _id: Id<"appointments">;
  date: string;
  time: string;
  status: AppointmentStatus;
  notes?: string;
  amountPaid?: number;
  paidAt?: number;
  doctor: {
    name: string;
    title: string;
    color: string;
    /** Exceptional per-doctor tariff (FCFA) — primes over the pricing grid. */
    consultationPrice?: number;
    academicRank?: AcademicRank;
  } | null;
  service: {
    name: string;
    durationMinutes: number;
    price: number;
    icon: string;
    color: string;
    isGeneralist?: boolean;
  } | null;
}

/**
 * Effective price of an appointment: the doctor's exceptional tariff, else
 * the clinic's category pricing grid, else the service's own price.
 */
export function appointmentPrice(
  a: AppointmentWithDetails,
  grid?: PricingGrid | null,
): number {
  if (!a.doctor || !a.service) return 0;
  return resolveConsultationPrice(a.doctor, a.service, grid);
}
```

- [ ] **Step 4: Lancer les tests pour confirmer le succès**

Run: `bun test src/lib/clinic.test.ts`
Expected: PASS — les 4 tests de `appointmentPrice` passent.

Run: `bun tsc -b --noEmit`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clinic.ts src/lib/clinic.test.ts
git commit -m "feat: resolve appointment price via the category pricing grid"
```

---

### Task 4: Grille tarifaire côté Convex (`src/convex/settings.ts`)

**Files:**
- Modify: `src/convex/settings.ts`

**Interfaces:**
- Consumes: `PricingGrid` (Task 1, `../lib/pricing`).
- Produces: `PRICING_GRID_KEY: string`, `getPricingGrid(db): Promise<PricingGrid | null>`, `setPricingGrid(db, grid)`, query `api.settings.pricingGrid`, mutation `api.settings.updatePricingGrid({ generalisteMedecin, generalisteProfesseur, specialisteMedecin, specialisteProfesseur })`. Consommés par les tasks 6, 7, 8, 9.

Note : pas de fichier de test — ce module est du code Convex (queries/mutations), hors du périmètre de `bun test` (voir CLAUDE.md : les tests couvrent la logique pure, pas les fonctions Convex). Vérification = codegen + typecheck (Step 3) ; le comportement sera exercé manuellement à la Task 11.

- [ ] **Step 1: Ajouter l'import du type `PricingGrid`**

Dans `src/convex/settings.ts`, remplace la ligne d'import de tête :

Ancien :
```ts
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  DatabaseReader,
  DatabaseWriter,
  mutation,
  query,
} from "./_generated/server";
```

Nouveau :
```ts
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { PricingGrid } from "../lib/pricing";
import {
  DatabaseReader,
  DatabaseWriter,
  mutation,
  query,
} from "./_generated/server";
```

- [ ] **Step 2: Ajouter les helpers, la query et la mutation**

Ajoute à la fin de `src/convex/settings.ts` :

```ts
/**
 * Grille tarifaire de la consultation (4 catégories), gérée par
 * l'administration. Stockée comme une ligne JSON dans `clinicSettings`,
 * même principe que le mot de passe partagé ci-dessus.
 */

export const PRICING_GRID_KEY = "pricingGrid";

/** Current pricing grid, or null when the administration hasn't set it yet. */
export async function getPricingGrid(
  db: DatabaseReader,
): Promise<PricingGrid | null> {
  const row = await db
    .query("clinicSettings")
    .withIndex("by_key", (q) => q.eq("key", PRICING_GRID_KEY))
    .unique();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as PricingGrid;
  } catch {
    return null;
  }
}

export async function setPricingGrid(db: DatabaseWriter, grid: PricingGrid) {
  const row = await db
    .query("clinicSettings")
    .withIndex("by_key", (q) => q.eq("key", PRICING_GRID_KEY))
    .unique();
  const value = JSON.stringify(grid);
  if (row) {
    await db.patch(row._id, { value });
  } else {
    await db.insert("clinicSettings", { key: PRICING_GRID_KEY, value });
  }
}

/** Current pricing grid (null if not yet configured by the administration). */
export const pricingGrid = query({
  args: {},
  handler: async (ctx) => {
    return await getPricingGrid(ctx.db);
  },
});

function cleanGridValue(value: number, label: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(
      `Indiquez un tarif valide (FCFA, sans décimales) pour ${label}.`,
    );
  }
  return value;
}

/** Staff: set the 4-category consultation pricing grid. */
export const updatePricingGrid = mutation({
  args: {
    generalisteMedecin: v.number(),
    generalisteProfesseur: v.number(),
    specialisteMedecin: v.number(),
    specialisteProfesseur: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Vous devez être connecté.");
    }
    const user = await ctx.db.get<"users">(userId);
    if (user?.role !== "staff") {
      throw new Error("Accès réservé à l'administration de la clinique.");
    }
    await setPricingGrid(ctx.db, {
      generalisteMedecin: cleanGridValue(
        args.generalisteMedecin,
        "Généraliste · Médecin",
      ),
      generalisteProfesseur: cleanGridValue(
        args.generalisteProfesseur,
        "Généraliste · Professeur",
      ),
      specialisteMedecin: cleanGridValue(
        args.specialisteMedecin,
        "Spécialiste · Médecin",
      ),
      specialisteProfesseur: cleanGridValue(
        args.specialisteProfesseur,
        "Spécialiste · Professeur",
      ),
    });
  },
});
```

- [ ] **Step 3: Régénérer les types et vérifier**

Run: `bunx convex dev --once`
Expected: pas d'erreur, `pricingGrid` et `updatePricingGrid` apparaissent dans `src/convex/_generated/api.d.ts`.

Run: `bun tsc -b --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/convex/settings.ts
git commit -m "feat: add pricingGrid query and updatePricingGrid mutation"
```

---

### Task 5: `academicRank` dans `createDoctor`/`updateDoctor` (`src/convex/doctors.ts`)

**Files:**
- Modify: `src/convex/doctors.ts`

**Interfaces:**
- Consumes: schéma `doctors.academicRank` (Task 2).
- Produces: `createDoctor`/`updateDoctor` acceptent désormais `academicRank?: "medecin" | "professeur"` et le stockent (défaut `"medecin"`). Consommé par la Task 8 (StaffDoctors.tsx).

Note : pas de fichier de test (fonctions Convex). Vérification = codegen + typecheck.

- [ ] **Step 1: Ajouter l'argument `academicRank` à `createDoctor`**

Dans `src/convex/doctors.ts`, remplace :

```ts
export const createDoctor = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    serviceId: v.id("services"),
    title: v.optional(v.string()),
    bio: v.optional(v.string()),
    phone: v.optional(v.string()),
    consultationPrice: v.optional(v.number()),
    schedule: v.optional(v.array(scheduleEntry)),
  },
```

par :

```ts
export const createDoctor = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    serviceId: v.id("services"),
    title: v.optional(v.string()),
    bio: v.optional(v.string()),
    phone: v.optional(v.string()),
    consultationPrice: v.optional(v.number()),
    academicRank: v.optional(
      v.union(v.literal("medecin"), v.literal("professeur")),
    ),
    schedule: v.optional(v.array(scheduleEntry)),
  },
```

Puis, dans le `handler` de `createDoctor`, remplace :

```ts
    return await ctx.db.insert("doctors", {
      name: composeName(firstName, lastName),
      firstName,
      lastName,
      serviceId: args.serviceId,
      title: args.title?.trim() || service.name,
      bio: args.bio?.trim() || "",
      phone: args.phone?.trim() || undefined,
      consultationPrice: cleanPrice(args.consultationPrice),
      schedule: cleanSchedule(args.schedule),
      color: DOCTOR_TINTS[count.length % DOCTOR_TINTS.length],
    });
```

par :

```ts
    return await ctx.db.insert("doctors", {
      name: composeName(firstName, lastName),
      firstName,
      lastName,
      serviceId: args.serviceId,
      title: args.title?.trim() || service.name,
      bio: args.bio?.trim() || "",
      phone: args.phone?.trim() || undefined,
      consultationPrice: cleanPrice(args.consultationPrice),
      academicRank: args.academicRank ?? "medecin",
      schedule: cleanSchedule(args.schedule),
      color: DOCTOR_TINTS[count.length % DOCTOR_TINTS.length],
    });
```

- [ ] **Step 2: Même changement pour `updateDoctor`**

Remplace :

```ts
export const updateDoctor = mutation({
  args: {
    doctorId: v.id("doctors"),
    firstName: v.string(),
    lastName: v.string(),
    serviceId: v.id("services"),
    title: v.optional(v.string()),
    bio: v.optional(v.string()),
    phone: v.optional(v.string()),
    consultationPrice: v.optional(v.number()),
    schedule: v.optional(v.array(scheduleEntry)),
  },
```

par :

```ts
export const updateDoctor = mutation({
  args: {
    doctorId: v.id("doctors"),
    firstName: v.string(),
    lastName: v.string(),
    serviceId: v.id("services"),
    title: v.optional(v.string()),
    bio: v.optional(v.string()),
    phone: v.optional(v.string()),
    consultationPrice: v.optional(v.number()),
    academicRank: v.optional(
      v.union(v.literal("medecin"), v.literal("professeur")),
    ),
    schedule: v.optional(v.array(scheduleEntry)),
  },
```

Et dans son `handler`, remplace :

```ts
    await ctx.db.patch(args.doctorId, {
      name,
      firstName,
      lastName,
      serviceId: args.serviceId,
      title: args.title?.trim() || service.name,
      bio: args.bio?.trim() || "",
      phone: args.phone?.trim() || undefined,
      consultationPrice: cleanPrice(args.consultationPrice),
      schedule: cleanSchedule(args.schedule),
    });
```

par :

```ts
    await ctx.db.patch(args.doctorId, {
      name,
      firstName,
      lastName,
      serviceId: args.serviceId,
      title: args.title?.trim() || service.name,
      bio: args.bio?.trim() || "",
      phone: args.phone?.trim() || undefined,
      consultationPrice: cleanPrice(args.consultationPrice),
      academicRank: args.academicRank ?? "medecin",
      schedule: cleanSchedule(args.schedule),
    });
```

- [ ] **Step 3: Régénérer les types et vérifier**

Run: `bunx convex dev --once`
Expected: pas d'erreur.

Run: `bun tsc -b --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/convex/doctors.ts
git commit -m "feat: accept academicRank on createDoctor/updateDoctor"
```

---

### Task 6: Données de seed — service généraliste + grille par défaut (`src/convex/seed.ts`)

**Files:**
- Modify: `src/convex/seed.ts`

**Interfaces:**
- Consumes: `PRICING_GRID_KEY` (Task 4, `./settings`), `DEFAULT_PRICING_GRID` (Task 1, `../lib/pricing`).
- Produces: le service « Médecine générale » a `isGeneralist: true` ; la grille tarifaire par défaut est semée une fois (idempotent), sans jamais écraser une valeur déjà personnalisée par l'administration.

- [ ] **Step 1: Marquer « Médecine générale » comme généraliste**

Dans `src/convex/seed.ts`, dans `SEED_SERVICES`, remplace l'entrée `general` :

Ancien :
```ts
  {
    key: "general",
    name: "Médecine générale",
    description:
      "Consultations de routine, prévention et suivi de votre santé au quotidien.",
    durationMinutes: 30,
    price: 10000, // FCFA
    icon: "stethoscope",
    color: "teal",
  },
```

Nouveau :
```ts
  {
    key: "general",
    name: "Médecine générale",
    description:
      "Consultations de routine, prévention et suivi de votre santé au quotidien.",
    durationMinutes: 30,
    price: 10000, // FCFA
    icon: "stethoscope",
    color: "teal",
    isGeneralist: true,
  },
```

- [ ] **Step 2: Semer la grille tarifaire par défaut (idempotent)**

Remplace la ligne d'import de tête :

Ancien :
```ts
import { STAFF_PASSWORD_DEFAULT, STAFF_PASSWORD_KEY } from "./settings";
import { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
```

Nouveau :
```ts
import {
  PRICING_GRID_KEY,
  STAFF_PASSWORD_DEFAULT,
  STAFF_PASSWORD_KEY,
} from "./settings";
import { DEFAULT_PRICING_GRID } from "../lib/pricing";
import { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
```

Puis, dans le `handler` de `ensureSeedData`, juste après le bloc qui sème `STAFF_PASSWORD_KEY` (donc avant le bloc `// Demo: seed one declared day off...`), ajoute :

```ts
    // Clinic settings: seed the default pricing grid — never overwrites a
    // grid the administration has already customized.
    const pricingGridRow = await ctx.db
      .query("clinicSettings")
      .withIndex("by_key", (q) => q.eq("key", PRICING_GRID_KEY))
      .unique();
    if (!pricingGridRow) {
      await ctx.db.insert("clinicSettings", {
        key: PRICING_GRID_KEY,
        value: JSON.stringify(DEFAULT_PRICING_GRID),
      });
    }
```

- [ ] **Step 3: Régénérer les types et vérifier**

Run: `bunx convex dev --once`
Expected: pas d'erreur.

Run: `bun tsc -b --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Vérifier le seed en local**

Run: `bunx convex run seed:ensureSeedData`
Expected: retourne `{ seeded: false, serviceCount: ... }` si déjà semé (dev existant), ou `{ seeded: true, ... }` sur une base vierge — dans les deux cas, sans erreur.

Si la base de dev existante a déjà des services (le cas courant), le service « Médecine générale » existant n'aura pas `isGeneralist` mis à jour automatiquement par ce mutation (elle ne fait que la 1ère insertion) : c'est acceptable pour cette tâche (le filet de sécurité `service.price` continue de fonctionner) — la Task 11 inclut une vérification manuelle et, si besoin, un correctif ponctuel via le dashboard Convex.

- [ ] **Step 5: Commit**

```bash
git add src/convex/seed.ts
git commit -m "feat: seed isGeneralist flag and default pricing grid"
```

---

### Task 7: Résolution du prix côté paiement (`src/convex/appointments.ts`, `src/convex/payments.ts`)

**Files:**
- Modify: `src/convex/appointments.ts`
- Modify: `src/convex/payments.ts`

**Interfaces:**
- Consumes: `resolveConsultationPrice` (Task 1), `getPricingGrid` (Task 4).
- Produces: `myAppointments`/`allAppointments` exposent désormais `doctor.academicRank` et `service.isGeneralist` (consommés par la Task 9 côté frontend) ; `recordPayment`, `getAppointmentPaymentInfo`, `recordMobilePayment` calculent le montant via la grille au lieu du seul `consultationPrice ?? price`.

Note : pas de fichier de test (fonctions Convex). Vérification = codegen + typecheck ; comportement exercé manuellement à la Task 11.

- [ ] **Step 1: Étendre les objets `doctor`/`service` renvoyés par `myAppointments`**

Dans `src/convex/appointments.ts`, remplace (dans `myAppointments`) :

```ts
          doctor: doctor
            ? {
                name: doctor.name,
                title: doctor.title,
                color: doctor.color,
                consultationPrice: doctor.consultationPrice,
              }
            : null,
          service: service
            ? {
                name: service.name,
                durationMinutes: service.durationMinutes,
                price: service.price,
                icon: service.icon,
                color: service.color,
              }
            : null,
        };
      }),
    );

    return sortAppointments(items);
  },
});

/** Every appointment in the clinic, with patient info. Staff only. */
```

par :

```ts
          doctor: doctor
            ? {
                name: doctor.name,
                title: doctor.title,
                color: doctor.color,
                consultationPrice: doctor.consultationPrice,
                academicRank: doctor.academicRank,
              }
            : null,
          service: service
            ? {
                name: service.name,
                durationMinutes: service.durationMinutes,
                price: service.price,
                icon: service.icon,
                color: service.color,
                isGeneralist: service.isGeneralist,
              }
            : null,
        };
      }),
    );

    return sortAppointments(items);
  },
});

/** Every appointment in the clinic, with patient info. Staff only. */
```

- [ ] **Step 2: Même extension pour `allAppointments`**

Toujours dans `src/convex/appointments.ts`, remplace (dans `allAppointments`) :

```ts
          doctor: doctor
            ? {
                name: doctor.name,
                title: doctor.title,
                color: doctor.color,
                consultationPrice: doctor.consultationPrice,
              }
            : null,
          service: service
            ? {
                name: service.name,
                durationMinutes: service.durationMinutes,
                price: service.price,
                icon: service.icon,
                color: service.color,
              }
            : null,
          patient: {
```

par :

```ts
          doctor: doctor
            ? {
                name: doctor.name,
                title: doctor.title,
                color: doctor.color,
                consultationPrice: doctor.consultationPrice,
                academicRank: doctor.academicRank,
              }
            : null,
          service: service
            ? {
                name: service.name,
                durationMinutes: service.durationMinutes,
                price: service.price,
                icon: service.icon,
                color: service.color,
                isGeneralist: service.isGeneralist,
              }
            : null,
          patient: {
```

- [ ] **Step 3: `recordPayment` — utiliser la grille**

Toujours dans `src/convex/appointments.ts`, remplace la ligne d'import :

Ancien :
```ts
import { computePatientShare } from "../lib/pricing";
```

Nouveau :
```ts
import { computePatientShare, resolveConsultationPrice } from "../lib/pricing";
import { getPricingGrid } from "./settings";
```

Puis, dans `recordPayment`, remplace :

```ts
    const service = await ctx.db.get(appointment.serviceId);
    if (!service) throw new Error("Service introuvable.");

    // The price of the consultation is set on the doctor's fiche; fall back
    // to the service price when the fiche has no tariff yet.
    const doctor = await ctx.db.get(appointment.doctorId);
    const price = doctor?.consultationPrice ?? service.price;
```

par :

```ts
    const service = await ctx.db.get(appointment.serviceId);
    if (!service) throw new Error("Service introuvable.");

    // The price of the consultation follows the doctor's own tariff if set,
    // else the clinic's category pricing grid, else the service price.
    const doctor = await ctx.db.get(appointment.doctorId);
    const grid = await getPricingGrid(ctx.db);
    const price = doctor
      ? resolveConsultationPrice(doctor, service, grid)
      : service.price;
```

- [ ] **Step 4: `getAppointmentPaymentInfo` — utiliser la grille**

Dans `src/convex/payments.ts`, remplace la ligne d'import :

Ancien :
```ts
import { computePatientShare } from "../lib/pricing";
```

Nouveau :
```ts
import { computePatientShare, resolveConsultationPrice } from "../lib/pricing";
import { getPricingGrid } from "./settings";
```

Puis, dans `getAppointmentPaymentInfo`, remplace :

```ts
    const [doctor, service, profile] = await Promise.all([
      ctx.db.get(appointment.doctorId),
      ctx.db.get(appointment.serviceId),
      ctx.db
        .query("patientProfiles")
        .withIndex("by_user", (q) => q.eq("userId", appointment.userId))
        .first(),
    ]);

    const price = doctor?.consultationPrice ?? service?.price ?? 0;
```

par :

```ts
    const [doctor, service, profile, grid] = await Promise.all([
      ctx.db.get(appointment.doctorId),
      ctx.db.get(appointment.serviceId),
      ctx.db
        .query("patientProfiles")
        .withIndex("by_user", (q) => q.eq("userId", appointment.userId))
        .first(),
      getPricingGrid(ctx.db),
    ]);

    const price =
      doctor && service ? resolveConsultationPrice(doctor, service, grid) : 0;
```

- [ ] **Step 5: `recordMobilePayment` — utiliser la grille**

Toujours dans `src/convex/payments.ts`, remplace :

```ts
    const [doctor, service, profile] = await Promise.all([
      ctx.db.get(appointment.doctorId),
      ctx.db.get(appointment.serviceId),
      ctx.db
        .query("patientProfiles")
        .withIndex("by_user", (q) => q.eq("userId", appointment.userId))
        .first(),
    ]);

    const amountPaid = computePatientShare(
      doctor?.consultationPrice ?? service?.price ?? 0,
      profile,
    );
```

par :

```ts
    const [doctor, service, profile, grid] = await Promise.all([
      ctx.db.get(appointment.doctorId),
      ctx.db.get(appointment.serviceId),
      ctx.db
        .query("patientProfiles")
        .withIndex("by_user", (q) => q.eq("userId", appointment.userId))
        .first(),
      getPricingGrid(ctx.db),
    ]);

    const mobilePrice =
      doctor && service ? resolveConsultationPrice(doctor, service, grid) : 0;
    const amountPaid = computePatientShare(mobilePrice, profile);
```

- [ ] **Step 6: Régénérer les types et vérifier**

Run: `bunx convex dev --once`
Expected: pas d'erreur (attention aux imports circulaires : `settings.ts` n'importe pas `appointments.ts`/`payments.ts`, donc pas de cycle).

Run: `bun tsc -b --noEmit`
Expected: aucune erreur.

Run: `bun test`
Expected: PASS (158+ tests, ceux de `pricing.test.ts`/`clinic.test.ts` inclus).

- [ ] **Step 7: Commit**

```bash
git add src/convex/appointments.ts src/convex/payments.ts
git commit -m "feat: resolve payment amounts via the category pricing grid"
```

---

### Task 8: Interface d'administration — fiche médecin + grille tarifaire (`src/components/dashboard/StaffDoctors.tsx`)

**Files:**
- Modify: `src/components/dashboard/StaffDoctors.tsx`

**Interfaces:**
- Consumes: `resolveConsultationPrice`, `PricingGrid`, `AcademicRank`, `DEFAULT_PRICING_GRID` (Task 1) ; `api.settings.pricingGrid`, `api.settings.updatePricingGrid` (Task 4) ; `academicRank` sur `createDoctor`/`updateDoctor` (Task 5).
- Produces: rien de consommé ailleurs (composant terminal). Vérification = typecheck + parcours manuel navigateur (pas de tests de composants React dans ce projet, cf. CLAUDE.md).

- [ ] **Step 1: Imports et types**

Remplace la ligne d'import de `@/lib/clinic` :

Ancien :
```ts
import {
  DAY_NAMES,
  DAY_SHORT_NAMES,
  doctorTint,
  formatFullDate,
  formatPrice,
  formatSchedule,
  initials,
  toDateKey,
  type DoctorScheduleEntry,
} from "@/lib/clinic";
```

Nouveau :
```ts
import {
  DAY_NAMES,
  DAY_SHORT_NAMES,
  doctorTint,
  formatFullDate,
  formatPrice,
  formatSchedule,
  initials,
  toDateKey,
  type DoctorScheduleEntry,
} from "@/lib/clinic";
import {
  DEFAULT_PRICING_GRID,
  resolveConsultationPrice,
  type AcademicRank,
  type PricingGrid,
} from "@/lib/pricing";
import { Checkbox } from "@/components/ui/checkbox";
```

Remplace l'interface `DoctorDoc` :

Ancien :
```ts
interface DoctorDoc {
  _id: Id<"doctors">;
  name: string;
  firstName?: string;
  lastName?: string;
  serviceId: Id<"services">;
  title: string;
  bio: string;
  phone?: string;
  consultationPrice?: number;
  schedule?: DoctorScheduleEntry[];
  color: string;
}
```

Nouveau :
```ts
interface DoctorDoc {
  _id: Id<"doctors">;
  name: string;
  firstName?: string;
  lastName?: string;
  serviceId: Id<"services">;
  title: string;
  bio: string;
  phone?: string;
  consultationPrice?: number;
  academicRank?: AcademicRank;
  schedule?: DoctorScheduleEntry[];
  color: string;
}
```

Remplace `DoctorForm` et `EMPTY_FORM` :

Ancien :
```ts
interface DoctorForm {
  firstName: string;
  lastName: string;
  serviceId: string;
  title: string;
  bio: string;
  phone: string;
  /** Consultation price, kept as a string while editing the input. */
  consultationPrice: string;
  schedule: DoctorScheduleEntry[];
}

const EMPTY_FORM: DoctorForm = {
  firstName: "",
  lastName: "",
  serviceId: "",
  title: "",
  bio: "",
  phone: "",
  consultationPrice: "",
  schedule: [],
};
```

Nouveau :
```ts
interface DoctorForm {
  firstName: string;
  lastName: string;
  serviceId: string;
  title: string;
  bio: string;
  phone: string;
  academicRank: AcademicRank;
  /** Whether the exceptional per-doctor tariff input is shown/used. */
  hasCustomPrice: boolean;
  /** Consultation price, kept as a string while editing the input. */
  consultationPrice: string;
  schedule: DoctorScheduleEntry[];
}

const EMPTY_FORM: DoctorForm = {
  firstName: "",
  lastName: "",
  serviceId: "",
  title: "",
  bio: "",
  phone: "",
  academicRank: "medecin",
  hasCustomPrice: false,
  consultationPrice: "",
  schedule: [],
};
```

- [ ] **Step 2: Récupérer la grille dans le composant racine et l'afficher**

Dans `StaffDoctors()`, remplace :

```ts
export function StaffDoctors() {
  const doctors = useQuery(api.catalog.listDoctors);
  const services = useQuery(api.catalog.listServices);
  const offDays = useQuery(api.doctors.listDoctorOffDays);
  const createDoctor = useMutation(api.doctors.createDoctor);
  const updateDoctor = useMutation(api.doctors.updateDoctor);
```

par :

```ts
export function StaffDoctors() {
  const doctors = useQuery(api.catalog.listDoctors);
  const services = useQuery(api.catalog.listServices);
  const offDays = useQuery(api.doctors.listDoctorOffDays);
  const grid = useQuery(api.settings.pricingGrid);
  const createDoctor = useMutation(api.doctors.createDoctor);
  const updateDoctor = useMutation(api.doctors.updateDoctor);
```

Puis, juste après le helper `serviceName` existant, ajoute un helper pour retrouver le service complet (pas seulement son nom) :

```ts
  const serviceName = (serviceId: Id<"services">) =>
    services?.find((s) => s._id === serviceId)?.name ?? "—";

  const serviceOf = (serviceId: Id<"services">) =>
    services?.find((s) => s._id === serviceId);
```

Ensuite, insère le panneau de grille tarifaire juste avant le commentaire `{/* Toolbar */}` :

```ts
      <PricingGridPanel grid={grid} />

      {/* Toolbar */}
```

- [ ] **Step 3: Passer `grid` au dialogue de fiche et au payload de sauvegarde**

Remplace le rendu de `DoctorDialog` :

Ancien :
```ts
      {dialog && (
        <DoctorDialog
          key={
            dialog.mode === "edit" ? dialog.doctor._id : "new"
          }
          doctor={dialog.mode === "edit" ? dialog.doctor : null}
          services={services ?? []}
          onSave={async (form) => {
            const price = form.consultationPrice.trim();
            const payload = {
              firstName: form.firstName,
              lastName: form.lastName,
              serviceId: form.serviceId as Id<"services">,
              title: form.title,
              bio: form.bio,
              phone: form.phone,
              schedule: form.schedule,
              consultationPrice:
                price === "" ? undefined : Number(price),
            };
            if (dialog.mode === "edit") {
              await updateDoctor({
                doctorId: dialog.doctor._id,
                ...payload,
              });
            } else {
              await createDoctor(payload);
            }
            handleSaved();
          }}
          onClose={() => setDialog(null)}
        />
      )}
```

Nouveau :
```ts
      {dialog && (
        <DoctorDialog
          key={
            dialog.mode === "edit" ? dialog.doctor._id : "new"
          }
          doctor={dialog.mode === "edit" ? dialog.doctor : null}
          services={services ?? []}
          grid={grid}
          onSave={async (form) => {
            const price = form.consultationPrice.trim();
            const payload = {
              firstName: form.firstName,
              lastName: form.lastName,
              serviceId: form.serviceId as Id<"services">,
              title: form.title,
              bio: form.bio,
              phone: form.phone,
              schedule: form.schedule,
              academicRank: form.academicRank,
              consultationPrice:
                form.hasCustomPrice && price !== ""
                  ? Number(price)
                  : undefined,
            };
            if (dialog.mode === "edit") {
              await updateDoctor({
                doctorId: dialog.doctor._id,
                ...payload,
              });
            } else {
              await createDoctor(payload);
            }
            handleSaved();
          }}
          onClose={() => setDialog(null)}
        />
      )}
```

- [ ] **Step 4: Afficher la catégorie et le prix calculé sur la carte médecin**

Remplace le bloc tarif de la carte (dans le `.map((d) => ...)` de la liste) :

Ancien :
```ts
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Coins className="size-3.5 shrink-0 text-primary" />
                  {d.consultationPrice != null ? (
                    <span className="font-semibold text-foreground">
                      {formatPrice(d.consultationPrice)}
                    </span>
                  ) : (
                    "Tarif non renseigné"
                  )}
                  <span>la consultation</span>
                </p>
```

Nouveau :
```ts
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Coins className="size-3.5 shrink-0 text-primary" />
                  {(() => {
                    const service = serviceOf(d.serviceId);
                    const price = service
                      ? resolveConsultationPrice(d, service, grid)
                      : undefined;
                    return (
                      <span className="font-semibold text-foreground">
                        {price != null ? formatPrice(price) : "—"}
                      </span>
                    );
                  })()}
                  <span>la consultation</span>
                  {d.consultationPrice != null && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      tarif personnalisé
                    </span>
                  )}
                </p>
                <p className="text-[11px] font-medium text-muted-foreground">
                  {serviceOf(d.serviceId)?.isGeneralist
                    ? "Généraliste"
                    : "Spécialiste"}{" "}
                  · {d.academicRank === "professeur" ? "Professeur" : "Médecin"}
                </p>
```

- [ ] **Step 5: Initialiser le formulaire du dialogue avec les nouveaux champs**

Dans `DoctorDialog`, remplace la signature et l'état initial :

Ancien :
```ts
function DoctorDialog({
  doctor,
  services,
  onSave,
  onClose,
}: {
  doctor: DoctorDoc | null;
  services: { _id: Id<"services">; name: string }[];
  onSave: (form: DoctorForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DoctorForm>(() =>
    doctor
      ? {
          firstName: doctor.firstName ?? "",
          lastName: doctor.lastName ?? "",
          serviceId: doctor.serviceId,
          title: doctor.title ?? "",
          bio: doctor.bio ?? "",
          phone: doctor.phone ?? "",
          consultationPrice:
            doctor.consultationPrice != null
              ? String(doctor.consultationPrice)
              : "",
          schedule: doctor.schedule ?? [],
        }
      : EMPTY_FORM,
  );
```

Nouveau :
```ts
function DoctorDialog({
  doctor,
  services,
  grid,
  onSave,
  onClose,
}: {
  doctor: DoctorDoc | null;
  services: { _id: Id<"services">; name: string; isGeneralist?: boolean; price: number }[];
  grid: PricingGrid | null | undefined;
  onSave: (form: DoctorForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DoctorForm>(() =>
    doctor
      ? {
          firstName: doctor.firstName ?? "",
          lastName: doctor.lastName ?? "",
          serviceId: doctor.serviceId,
          title: doctor.title ?? "",
          bio: doctor.bio ?? "",
          phone: doctor.phone ?? "",
          academicRank: doctor.academicRank ?? "medecin",
          hasCustomPrice: doctor.consultationPrice != null,
          consultationPrice:
            doctor.consultationPrice != null
              ? String(doctor.consultationPrice)
              : "",
          schedule: doctor.schedule ?? [],
        }
      : EMPTY_FORM,
  );
```

- [ ] **Step 6: Ajuster la validation — le prix n'est requis que si « tarif personnalisé » est coché**

Remplace :

```ts
    if (!form.serviceId) {
      setError("Choisissez la spécialité du médecin.");
      return;
    }
    const price = Number(form.consultationPrice);
    if (
      !form.consultationPrice.trim() ||
      !Number.isInteger(price) ||
      price <= 0
    ) {
      setError("Indiquez le prix de la consultation en FCFA (sans décimales).");
      return;
    }
```

par :

```ts
    if (!form.serviceId) {
      setError("Choisissez la spécialité du médecin.");
      return;
    }
    if (form.hasCustomPrice) {
      const price = Number(form.consultationPrice);
      if (
        !form.consultationPrice.trim() ||
        !Number.isInteger(price) ||
        price <= 0
      ) {
        setError(
          "Indiquez le tarif personnalisé en FCFA (sans décimales), ou décochez la case.",
        );
        return;
      }
    }
```

- [ ] **Step 7: Remplacer le champ de prix par la catégorie + le prix calculé + la case à cocher**

Remplace le bloc `Field label="Prix de la consultation (FCFA)"` :

Ancien :
```ts
          <Field label="Prix de la consultation (FCFA)">
            <div className="relative">
              <Coins className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                step={500}
                inputMode="numeric"
                value={form.consultationPrice}
                onChange={(e) => set({ consultationPrice: e.target.value })}
                placeholder="10 000"
                className="pl-9"
                disabled={saving}
              />
            </div>
            <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
              Montant en FCFA, sans décimales. Il s'affiche aux patients lors
              de la réservation et sert au calcul du paiement.
            </p>
          </Field>
```

Nouveau :
```ts
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type (déduit de la spécialité)">
              <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground">
                {services.find((s) => s._id === form.serviceId)?.isGeneralist
                  ? "Généraliste"
                  : "Spécialiste"}
              </div>
            </Field>
            <Field label="Grade">
              <Select
                value={form.academicRank}
                onValueChange={(v) =>
                  set({ academicRank: v as AcademicRank })
                }
                disabled={saving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medecin">Médecin</SelectItem>
                  <SelectItem value="professeur">Professeur</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Coins className="size-4 text-primary" />
              Prix de la consultation
            </span>
            <span className="text-sm font-bold text-foreground">
              {(() => {
                const selectedService = services.find(
                  (s) => s._id === form.serviceId,
                );
                if (!selectedService) return "—";
                const price = form.hasCustomPrice
                  ? Number(form.consultationPrice) || 0
                  : resolveConsultationPrice(
                      { academicRank: form.academicRank },
                      selectedService,
                      grid ?? DEFAULT_PRICING_GRID,
                    );
                return formatPrice(price);
              })()}
            </span>
          </div>

          <Field label="">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={form.hasCustomPrice}
                onCheckedChange={(checked) =>
                  set({ hasCustomPrice: checked === true })
                }
                disabled={saving}
              />
              Tarif personnalisé pour ce médecin (intervention particulière)
            </label>
            {form.hasCustomPrice && (
              <div className="relative mt-2">
                <Coins className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="number"
                  min={0}
                  step={500}
                  inputMode="numeric"
                  value={form.consultationPrice}
                  onChange={(e) =>
                    set({ consultationPrice: e.target.value })
                  }
                  placeholder="10 000"
                  className="pl-9"
                  disabled={saving}
                />
              </div>
            )}
            <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
              Sans case cochée, le prix suit automatiquement la grille
              tarifaire de la clinique selon le type et le grade ci-dessus.
            </p>
          </Field>
```

- [ ] **Step 8: Ajouter le composant `PricingGridPanel`**

Ajoute ce nouveau composant à la fin de `src/components/dashboard/StaffDoctors.tsx` (après `function Field({ ... })`) :

```ts
/* ------------------------------------------------------------------ */
/* Pricing grid (grille tarifaire)                                     */
/* ------------------------------------------------------------------ */

const GRID_FIELDS: { key: keyof PricingGrid; label: string }[] = [
  { key: "generalisteMedecin", label: "Généraliste · Médecin" },
  { key: "generalisteProfesseur", label: "Généraliste · Professeur" },
  { key: "specialisteMedecin", label: "Spécialiste · Médecin" },
  { key: "specialisteProfesseur", label: "Spécialiste · Professeur" },
];

function PricingGridPanel({
  grid,
}: {
  grid: PricingGrid | null | undefined;
}) {
  const updatePricingGrid = useMutation(api.settings.updatePricingGrid);
  const [form, setForm] = useState<Record<keyof PricingGrid, string>>(() => {
    const base = grid ?? DEFAULT_PRICING_GRID;
    return {
      generalisteMedecin: String(base.generalisteMedecin),
      generalisteProfesseur: String(base.generalisteProfesseur),
      specialisteMedecin: String(base.specialisteMedecin),
      specialisteProfesseur: String(base.specialisteProfesseur),
    };
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePricingGrid({
        generalisteMedecin: Number(form.generalisteMedecin),
        generalisteProfesseur: Number(form.generalisteProfesseur),
        specialisteMedecin: Number(form.specialisteMedecin),
        specialisteProfesseur: Number(form.specialisteProfesseur),
      });
      toast.success("Grille tarifaire mise à jour.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (grid === undefined) {
    return <Skeleton className="h-32 rounded-2xl" />;
  }

  return (
    <Card className="border-border/70 p-5 shadow-soft">
      <p className="text-sm font-semibold text-foreground">
        Grille tarifaire de la consultation
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Prix par défaut selon le type de médecin et son grade. Un médecin
        peut avoir un tarif personnalisé (voir sa fiche) qui prime sur cette
        grille.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GRID_FIELDS.map(({ key, label }) => (
          <div key={key}>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {label}
            </Label>
            <div className="relative">
              <Coins className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                step={500}
                inputMode="numeric"
                value={form[key]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: e.target.value }))
                }
                className="pl-9"
                disabled={saving}
              />
            </div>
          </div>
        ))}
      </div>
      <Button
        onClick={handleSave}
        disabled={saving}
        className="mt-4 rounded-full"
        size="sm"
      >
        {saving && <Loader2 className="size-4 animate-spin" />}
        Enregistrer la grille
      </Button>
    </Card>
  );
}
```

- [ ] **Step 9: Typecheck**

Run: `bunx convex dev --once`
Expected: pas d'erreur.

Run: `bun tsc -b --noEmit`
Expected: aucune erreur. Corrige tout écart de type (ex. si `services` passé à `DoctorDialog` n'a pas `isGeneralist`/`price` dans son type d'appel — au besoin, élargis le type inline au lieu de `{ _id, name }` pour inclure ces deux champs, comme indiqué dans la signature du Step 5).

- [ ] **Step 10: Vérification manuelle (navigateur)**

Avec `bun run dev` + `bunx convex dev` lancés :
1. Se connecter en Administration (mot de passe partagé).
2. Aller sur Médecins → vérifier que le panneau « Grille tarifaire » s'affiche avec 4 champs pré-remplis.
3. Modifier une valeur, Enregistrer → toast de succès.
4. Ouvrir la fiche d'un médecin existant → le type (Généraliste/Spécialiste) s'affiche en lecture seule, le Grade est sélectionnable, le prix affiché change quand on change le Grade.
5. Cocher « Tarif personnalisé », taper un montant, enregistrer → la carte du médecin affiche ce montant avec le badge « tarif personnalisé ».
6. Décocher/vider puis enregistrer → le prix redevient celui de la grille.

- [ ] **Step 11: Commit**

```bash
git add src/components/dashboard/StaffDoctors.tsx
git commit -m "feat: manage doctor category/grade and pricing grid in admin UI"
```

---

### Task 9: Propager la grille aux écrans de réservation et de paiement patient/staff

**Files:**
- Modify: `src/components/dashboard/BookAppointment.tsx`
- Modify: `src/components/dashboard/MyAppointments.tsx`
- Modify: `src/components/dashboard/StaffPlanning.tsx`
- Modify: `src/components/dashboard/AppointmentCard.tsx`

**Interfaces:**
- Consumes: `resolveConsultationPrice`, `PricingGrid` (Task 1) ; `appointmentPrice(a, grid)` (Task 3) ; `api.settings.pricingGrid` (Task 4).
- Produces: rien de consommé ailleurs. Vérification = typecheck + parcours manuel.

- [ ] **Step 1: `BookAppointment.tsx` — récupérer la grille**

Remplace la ligne d'import de `@/lib/clinic` :

Ancien :
```ts
import {
  doctorTint,
  doctorWorksOn,
  formatFullDate,
  formatPrice,
  formatTimeRange,
  initials,
  serviceIcon,
  serviceTint,
  toDateKey,
} from "@/lib/clinic";
```

Nouveau :
```ts
import {
  doctorTint,
  doctorWorksOn,
  formatFullDate,
  formatPrice,
  formatTimeRange,
  initials,
  serviceIcon,
  serviceTint,
  toDateKey,
} from "@/lib/clinic";
import { resolveConsultationPrice } from "@/lib/pricing";
```

Remplace :

```ts
  const services = useQuery(api.catalog.listServices);
  const doctors = useQuery(api.catalog.listDoctors);
```

par :

```ts
  const services = useQuery(api.catalog.listServices);
  const doctors = useQuery(api.catalog.listDoctors);
  const grid = useQuery(api.settings.pricingGrid);
```

- [ ] **Step 2: `BookAppointment.tsx` — les 3 points d'affichage du prix**

Remplace (dans `handleConfirm`) :

```ts
        price: selectedDoctor.consultationPrice ?? selectedService.price,
```

par :

```ts
        price: resolveConsultationPrice(
          selectedDoctor,
          selectedService,
          grid,
        ),
```

Remplace (dans la liste des médecins) :

```ts
                        {d.consultationPrice != null
                          ? formatPrice(d.consultationPrice)
                          : formatPrice(selectedService?.price ?? 0)}
```

par :

```ts
                        {selectedService
                          ? formatPrice(
                              resolveConsultationPrice(
                                d,
                                selectedService,
                                grid,
                              ),
                            )
                          : "—"}
```

Remplace (dans le récapitulatif « Total ») :

```ts
              {selectedService
                ? formatPrice(
                    selectedDoctor?.consultationPrice ?? selectedService.price,
                  )
                : "—"}
```

par :

```ts
              {selectedService && selectedDoctor
                ? formatPrice(
                    resolveConsultationPrice(
                      selectedDoctor,
                      selectedService,
                      grid,
                    ),
                  )
                : selectedService
                  ? formatPrice(selectedService.price)
                  : "—"}
```

- [ ] **Step 3: `MyAppointments.tsx` — récupérer et propager la grille**

Remplace :

```ts
export function MyAppointments({ onBook }: { onBook: () => void }) {
  const items = useQuery(api.appointments.myAppointments);
  const cancelAppointment = useMutation(api.appointments.cancelAppointment);
  const waiting = useQuery(api.waitingList.myWaitingList);
  const leaveWaitingList = useMutation(api.waitingList.leaveWaitingList);
  const profile = useQuery(api.records.myProfile);
```

par :

```ts
export function MyAppointments({ onBook }: { onBook: () => void }) {
  const items = useQuery(api.appointments.myAppointments);
  const cancelAppointment = useMutation(api.appointments.cancelAppointment);
  const waiting = useQuery(api.waitingList.myWaitingList);
  const leaveWaitingList = useMutation(api.waitingList.leaveWaitingList);
  const profile = useQuery(api.records.myProfile);
  const grid = useQuery(api.settings.pricingGrid);
```

Remplace :

```ts
  const handleReceipt = (a: AppointmentWithDetails) => {
    if (a.amountPaid == null) return;
    const price = appointmentPrice(a);
```

par :

```ts
  const handleReceipt = (a: AppointmentWithDetails) => {
    if (a.amountPaid == null) return;
    const price = appointmentPrice(a, grid);
```

Remplace le rendu de `<AppointmentCard appointment={a} ...>` — trouve :

```ts
            <AppointmentCard
              key={a._id}
              appointment={a}
```

et remplace par :

```ts
            <AppointmentCard
              key={a._id}
              appointment={a}
              grid={grid}
```

- [ ] **Step 4: `AppointmentCard.tsx` — accepter et utiliser `grid`**

Remplace la ligne d'import :

Ancien :
```ts
import {
  appointmentPrice,
  doctorTint,
  formatPrice,
  formatShortDate,
  formatTimeRange,
  initials,
  serviceIcon,
  type AppointmentWithDetails,
} from "@/lib/clinic";
```

Nouveau :
```ts
import {
  appointmentPrice,
  doctorTint,
  formatPrice,
  formatShortDate,
  formatTimeRange,
  initials,
  serviceIcon,
  type AppointmentWithDetails,
} from "@/lib/clinic";
import type { PricingGrid } from "@/lib/pricing";
```

Remplace la signature du composant :

Ancien :
```ts
export function AppointmentCard({
  appointment,
  actions,
  override,
  className,
}: {
  appointment: AppointmentWithDetails;
  actions?: ReactNode;
  /** When provided (staff view), replaces the doctor block with a person block. */
  override?: { title: string; subtitle: string; tint: string };
  className?: string;
}) {
```

Nouveau :
```ts
export function AppointmentCard({
  appointment,
  actions,
  override,
  className,
  grid,
}: {
  appointment: AppointmentWithDetails;
  actions?: ReactNode;
  /** When provided (staff view), replaces the doctor block with a person block. */
  override?: { title: string; subtitle: string; tint: string };
  className?: string;
  grid?: PricingGrid | null;
}) {
```

Remplace l'appel au prix :

Ancien :
```ts
                      · {formatPrice(appointmentPrice(appointment))}
```

Nouveau :
```ts
                      · {formatPrice(appointmentPrice(appointment, grid))}
```

- [ ] **Step 5: `StaffPlanning.tsx` — grille dans la vue planning et dans le dialogue de paiement**

Trouve la déclaration `const items = useQuery(api.appointments.allAppointments);` dans le composant principal `StaffPlanning` et ajoute juste après :

```ts
  const grid = useQuery(api.settings.pricingGrid);
```

Remplace :

```ts
                      {a.status === "pending" ? (
                        <div className="flex flex-col items-start gap-1.5">
                          <span className="text-sm font-bold text-foreground">
                            {formatPrice(
                              computePatientShare(
                                appointmentPrice(a),
                                a.insurance,
                              ),
                            )}
                          </span>
```

par :

```ts
                      {a.status === "pending" ? (
                        <div className="flex flex-col items-start gap-1.5">
                          <span className="text-sm font-bold text-foreground">
                            {formatPrice(
                              computePatientShare(
                                appointmentPrice(a, grid),
                                a.insurance,
                              ),
                            )}
                          </span>
```

Dans `PaymentDialog` (composant séparé plus bas dans le même fichier), remplace :

```ts
  const recordPayment = useMutation(api.appointments.recordPayment);
  const integration = useQuery(api.payments.getIntegrationStatus);
```

par :

```ts
  const recordPayment = useMutation(api.appointments.recordPayment);
  const integration = useQuery(api.payments.getIntegrationStatus);
  const grid = useQuery(api.settings.pricingGrid);
```

Puis remplace :

```ts
  const price = appointmentPrice(appointment);
```

par :

```ts
  const price = appointmentPrice(appointment, grid);
```

- [ ] **Step 6: Typecheck**

Run: `bunx convex dev --once`
Expected: pas d'erreur.

Run: `bun tsc -b --noEmit`
Expected: aucune erreur.

- [ ] **Step 7: Vérification manuelle (navigateur)**

1. Espace patient → Prendre rendez-vous : choisir un service, vérifier que chaque médecin affiche un prix cohérent avec sa catégorie (ou son tarif personnalisé) ; le récapitulatif affiche le même montant.
2. Espace patient → Mes rendez-vous : le montant affiché/le reçu PDF correspondent.
3. Administration → Planning : le montant à encaisser d'un rendez-vous en attente correspond, et le dialogue de paiement affiche le même prix.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/BookAppointment.tsx src/components/dashboard/MyAppointments.tsx src/components/dashboard/StaffPlanning.tsx src/components/dashboard/AppointmentCard.tsx
git commit -m "feat: use the pricing grid across booking and payment screens"
```

---

### Task 10: Retirer le prix de la page d'accueil publique (`src/pages/Landing.tsx`)

**Files:**
- Modify: `src/pages/Landing.tsx`

**Interfaces:**
- Consumes: rien de nouveau.
- Produces: rien. Vérification = typecheck + parcours manuel.

- [ ] **Step 1: Retirer les champs prix de `DoctorInfo` et des données de secours**

Remplace :

```ts
interface DoctorInfo {
  _id?: string;
  name: string;
  title: string;
  color: string;
  bio?: string;
  phone?: string;
  consultationPrice?: number;
  schedule?: DoctorScheduleEntry[];
  serviceName?: string;
  servicePrice?: number;
}
```

par :

```ts
interface DoctorInfo {
  _id?: string;
  name: string;
  title: string;
  color: string;
  bio?: string;
  phone?: string;
  schedule?: DoctorScheduleEntry[];
  serviceName?: string;
}
```

Dans `FALLBACK_DOCTORS`, retire la ligne `consultationPrice: ...,` et la ligne `servicePrice: ...,` de chacune des 6 entrées (ex. la première devient) :

Ancien :
```ts
  {
    name: "Dr Camille Moreau",
    title: "Médecin généraliste",
    color: "teal",
    bio: "Plus de 12 ans d'expérience en médecine de famille.",
    phone: "+225 07 00 01 02 03",
    consultationPrice: 10000,
    serviceName: "Médecine générale",
    servicePrice: 10000,
  },
```

Nouveau :
```ts
  {
    name: "Dr Camille Moreau",
    title: "Médecin généraliste",
    color: "teal",
    bio: "Plus de 12 ans d'expérience en médecine de famille.",
    phone: "+225 07 00 01 02 03",
    serviceName: "Médecine générale",
  },
```

Applique le même retrait des deux lignes (`consultationPrice`, `servicePrice`) aux 5 autres entrées (Dr Sophie Dubois, Dr Léa Fontaine, Dr Chloé Bernard, Dr Emma Rousseau, Dr Inès Lambert).

- [ ] **Step 2: Retirer le calcul de prix dans la construction des médecins**

Remplace :

```ts
  const doctors: DoctorInfo[] | undefined = useMemo(() => {
    if (!doctorsQuery) return undefined;
    return doctorsQuery.map((d) => {
      const service = servicesQuery?.find((s) => s._id === d.serviceId);
      return {
        _id: d._id,
        name: d.name,
        title: d.title,
        color: d.color,
        bio: d.bio,
        phone: d.phone,
        consultationPrice: d.consultationPrice,
        schedule: d.schedule,
        serviceName: service?.name,
        servicePrice: service?.price,
      };
    });
  }, [doctorsQuery, servicesQuery]);
```

par :

```ts
  const doctors: DoctorInfo[] | undefined = useMemo(() => {
    if (!doctorsQuery) return undefined;
    return doctorsQuery.map((d) => {
      const service = servicesQuery?.find((s) => s._id === d.serviceId);
      return {
        _id: d._id,
        name: d.name,
        title: d.title,
        color: d.color,
        bio: d.bio,
        phone: d.phone,
        schedule: d.schedule,
        serviceName: service?.name,
      };
    });
  }, [doctorsQuery, servicesQuery]);
```

- [ ] **Step 3: Retirer l'affichage du prix sur la carte praticien**

Remplace :

```ts
            {doctors.map((d, i) => {
              const price = d.consultationPrice ?? d.servicePrice;
              return (
```

par :

```ts
            {doctors.map((d, i) => {
              return (
```

Remplace :

```ts
                  {price != null ? (
                    <p className="mt-2 flex items-center gap-1 text-sm font-bold text-primary">
                      <Coins className="size-3.5" />
                      {formatPrice(price)}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Tarif à la réservation
                    </p>
                  )}
```

par :

```ts
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tarif communiqué à la réservation
                  </p>
```

- [ ] **Step 4: Retirer l'affichage du prix dans la fiche praticien (dialogue public)**

Remplace :

```ts
function DoctorSheet({
  doctor,
  onClose,
}: {
  doctor: DoctorInfo;
  onClose: () => void;
}) {
  const price = doctor.consultationPrice ?? doctor.servicePrice;
  return (
```

par :

```ts
function DoctorSheet({
  doctor,
  onClose,
}: {
  doctor: DoctorInfo;
  onClose: () => void;
}) {
  return (
```

Remplace :

```ts
        {/* Tariff */}
        <div className="flex items-center justify-between rounded-2xl border border-primary/25 bg-primary/[0.05] px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Coins className="size-4 text-primary" />
            Consultation
          </span>
          <span className="text-lg font-bold tracking-tight text-primary">
            {price != null ? formatPrice(price) : "Tarif à la réservation"}
          </span>
        </div>
```

par :

```ts
        {/* Tariff */}
        <div className="flex items-center justify-between rounded-2xl border border-primary/25 bg-primary/[0.05] px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Coins className="size-4 text-primary" />
            Consultation
          </span>
          <span className="text-sm font-medium text-muted-foreground">
            Tarif communiqué à la réservation
          </span>
        </div>
```

- [ ] **Step 5: Typecheck**

Run: `bun tsc -b --noEmit`
Expected: aucune erreur (vérifie qu'aucune autre référence à `consultationPrice`/`servicePrice`/`price` ne subsiste dans `Landing.tsx` — `formatPrice` et `Coins` restent utilisés ailleurs dans le fichier, donc leurs imports restent nécessaires).

- [ ] **Step 6: Vérification manuelle (navigateur)**

Ouvrir la page d'accueil sans être connecté : les cartes praticiens et la fiche détaillée d'un praticien n'affichent plus aucun montant, juste « Tarif communiqué à la réservation ».

- [ ] **Step 7: Commit**

```bash
git add src/pages/Landing.tsx
git commit -m "feat: hide consultation price from the public landing page"
```

---

### Task 11: Vérification finale complète

**Files:** aucun (vérification uniquement).

- [ ] **Step 1: Suite de tests complète**

Run: `bun test`
Expected: tous les tests passent (les ~165+ tests existants + les nouveaux de `pricing.test.ts`/`clinic.test.ts`).

- [ ] **Step 2: Codegen + typecheck**

Run: `bunx convex dev --once`
Expected: pas d'erreur.

Run: `bun tsc -b --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Lint**

Run: `bun run lint`
Expected: aucune erreur.

- [ ] **Step 4: Parcours manuel de bout en bout (navigateur, `bun run dev` + `bunx convex dev`)**

1. Administration → Médecins : régler la grille tarifaire (4 valeurs), créer un nouveau médecin sans tarif personnalisé → son prix suit la grille selon sa spécialité/grade.
2. Cocher « tarif personnalisé » sur un médecin existant, lui donner un prix différent → la carte et tous les écrans qui l'affichent (réservation, planning, paiement) montrent ce prix, pas celui de la grille.
3. Espace patient : réserver un rendez-vous avec un médecin sans tarif personnalisé → le prix affiché pendant la réservation et au paiement correspond à la grille.
4. Page d'accueil (déconnecté) : aucun prix visible sur les cartes praticiens ni dans la fiche détaillée.
5. Reçu PDF d'un rendez-vous payé : le montant reste correct.

- [ ] **Step 5: Commit final (si des ajustements ont eu lieu pendant la vérification)**

```bash
git add -A
git commit -m "chore: final verification pass for category-based pricing"
```
