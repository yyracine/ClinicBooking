# Category-Based Pricing Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the 4-cell pricing grid (medecin/professeur × generalist/specialist) to a simple 3-category model (Docteur Généraliste, Docteur Spécialiste, Professeur). Each doctor has one category; tariffs are displayed to patients and admins via real-time updates.

**Architecture:** Simplify data model by replacing `academicRank` + `consultationPrice` with a single `category` field. Store 3 prices in the grid (one per category). Admin manages grid from Médecins tab; patients see grid at top of booking flow; doctor cards display tariff based on category.

**Tech Stack:** Convex (schema + queries + mutations), React (components), TypeScript (strict typing), Tailwind CSS (UI)

## Global Constraints

- **Database:** Convex `doctors` table and `clinicSettings` key-value store
- **TypeScript:** Strict mode; regenerate types after schema changes (`bun convex dev --once`)
- **UI Language:** French (all labels, placeholders, error messages)
- **Currency:** FCFA with no decimals (use `formatPrice()` helper)
- **Query reactivity:** Convex queries auto-update UI when underlying data changes
- **Dates/times:** Use local key strings (YYYY-MM-DD, HH:mm), never JS Date objects for storage
- **Accessibility:** Follow shadcn/ui patterns (Button, Select, Input, Dialog, etc.)

---

## File Structure

**Modified files:**
- `src/convex/schema.ts` — Update `doctors` table (replace academicRank + consultationPrice with category)
- `src/lib/pricing.ts` — Simplify PricingGrid interface and resolveConsultationPrice() function
- `src/convex/settings.ts` — Update getPricingGrid(), setPricingGrid(), updatePricingGrid()
- `src/components/dashboard/StaffDoctors.tsx` — Add category field to form, add PricingGridManager component, display tariff in cards
- `src/components/dashboard/BookAppointment.tsx` — Add PricingGridDisplay at top, simplify price calculation calls

**Created files:**
- `src/convex/migrations/migrateDoctorCategories.ts` — One-time migration script
- `src/lib/pricing.test.ts` — Unit tests for simplified pricing logic (update existing or create if missing)

**No new dependencies required.**

---

## Task Execution Order

Tasks should be completed in this order due to dependencies:
1. Schema changes → Type regeneration → All other tasks depend on new types
2. Pricing logic update
3. Settings update
4. UI Components (order doesn't matter)
5. Migration script
6. Tests
7. Manual testing

---

# Tasks

### Task 1: Update `doctors` schema

**Files:**
- Modify: `src/convex/schema.ts` (lines ~71-95, the `doctors` table definition)

**Interfaces:**
- Consumes: (schema definition context only)
- Produces: `doctors` table with `category: "generaliste" | "specialiste" | "professeur"` field (required)

**Context:**
The `doctors` table currently has `academicRank` (optional, "medecin" | "professeur") and `consultationPrice` (optional override). You're replacing both with a single `category` field.

- [ ] **Step 1: Open schema.ts**

```bash
code src/convex/schema.ts
```

- [ ] **Step 2: Find the `doctors` table definition (around line 71)**

Look for the line starting with `doctors: defineTable({`. The table spans roughly lines 71–95.

- [ ] **Step 3: Replace `academicRank` and `consultationPrice` with `category`**

**Current code (find this):**
```typescript
doctors: defineTable({
  name: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  serviceId: v.id("services"),
  title: v.string(),
  bio: v.string(),
  phone: v.optional(v.string()),
  consultationPrice: v.optional(v.number()), // ← REMOVE
  academicRank: v.optional(
    v.union(v.literal("medecin"), v.literal("professeur")),
  ), // ← REMOVE
  schedule: v.optional(
    v.array(
      v.object({
        day: v.number(),
        start: v.string(),
        end: v.string(),
      }),
    ),
  ),
  color: v.string(),
  // ... other fields
}),
```

**Replace with:**
```typescript
doctors: defineTable({
  name: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  serviceId: v.id("services"),
  title: v.string(),
  bio: v.string(),
  phone: v.optional(v.string()),
  category: v.union(
    v.literal("generaliste"),
    v.literal("specialiste"),
    v.literal("professeur"),
  ),
  schedule: v.optional(
    v.array(
      v.object({
        day: v.number(),
        start: v.string(),
        end: v.string(),
      }),
    ),
  ),
  color: v.string(),
  // ... other fields (unchanged)
}),
```

- [ ] **Step 4: Commit**

```bash
git add src/convex/schema.ts
git commit -m "feat: replace academicRank + consultationPrice with category field in doctors schema"
```

---

### Task 2: Regenerate TypeScript types

**Files:**
- (Generated files only: `src/convex/_generated/`)

**Interfaces:**
- Consumes: Updated schema from Task 1
- Produces: Fresh TypeScript types reflecting new `doctors` schema

**Context:**
After schema changes, Convex auto-generates TypeScript definitions. This must run before you can use the new `category` field in code.

- [ ] **Step 1: Run Convex dev once to regenerate types**

```bash
bun convex dev --once
```

Expected output: Should complete without errors and regenerate `src/convex/_generated/` files. This may take 10-30 seconds.

- [ ] **Step 2: Type check**

```bash
bun tsc -b --noEmit
```

Expected output: No TypeScript errors related to schema changes. If errors appear (e.g., "doctors has no property category"), the codegen didn't complete — try step 1 again.

---

### Task 3: Update `src/lib/pricing.ts`

**Files:**
- Modify: `src/lib/pricing.ts` (lines ~31-78)

**Interfaces:**
- Consumes: `doctor: { category: "generaliste" | "specialiste" | "professeur" }`
- Produces: `PricingGrid = { generaliste, specialiste, professeur }` and `resolveConsultationPrice(doctor, grid) → number`

**Context:**
Simplify the pricing logic. The old logic was: check doctor.consultationPrice override → check grid based on academicRank + service.isGeneralist → fall back to service.price. New logic: always use grid[doctor.category], fallback to DEFAULT_PRICING_GRID.

- [ ] **Step 1: Open pricing.ts**

```bash
code src/lib/pricing.ts
```

- [ ] **Step 2: Replace PricingGrid interface (lines ~34–39)**

**Current:**
```typescript
export interface PricingGrid {
  generalisteMedecin: number;
  generalisteProfesseur: number;
  specialisteMedecin: number;
  specialisteProfesseur: number;
}
```

**Replace with:**
```typescript
export interface PricingGrid {
  generaliste: number;
  specialiste: number;
  professeur: number;
}
```

- [ ] **Step 3: Replace DEFAULT_PRICING_GRID (lines ~42–47)**

**Current:**
```typescript
export const DEFAULT_PRICING_GRID: PricingGrid = {
  generalisteMedecin: 10000,
  generalisteProfesseur: 15000,
  specialisteMedecin: 20000,
  specialisteProfesseur: 30000,
};
```

**Replace with:**
```typescript
export const DEFAULT_PRICING_GRID: PricingGrid = {
  generaliste: 10000,
  specialiste: 20000,
  professeur: 30000,
};
```

- [ ] **Step 4: Remove AcademicRank type (line ~31)**

**Find and remove:**
```typescript
export type AcademicRank = "medecin" | "professeur";
```

(No longer needed.)

- [ ] **Step 5: Replace resolveConsultationPrice function (lines ~59–78)**

**Current:**
```typescript
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

**Replace with:**
```typescript
export function resolveConsultationPrice(
  doctor: { category: "generaliste" | "specialiste" | "professeur" },
  grid: PricingGrid | null | undefined,
): number {
  if (!grid) return DEFAULT_PRICING_GRID[doctor.category];
  return grid[doctor.category];
}
```

- [ ] **Step 6: Verify file looks correct**

```bash
bun tsc -b --noEmit
```

Expected: No errors in pricing.ts.

- [ ] **Step 7: Commit**

```bash
git add src/lib/pricing.ts
git commit -m "feat: simplify PricingGrid and resolveConsultationPrice for 3-category model"
```

---

### Task 4: Update `src/convex/settings.ts`

**Files:**
- Modify: `src/convex/settings.ts` (lines ~3, ~87-160 approximately — find getPricingGrid, setPricingGrid, updatePricingGrid)

**Interfaces:**
- Consumes: New `PricingGrid = { generaliste, specialiste, professeur }` from Task 3
- Produces: Updated `getPricingGrid()`, `setPricingGrid()`, and `updatePricingGrid` mutation

**Context:**
Update the settings layer to handle 3-price grid instead of 4-price. The mutations will now accept 3 inputs instead of 4.

- [ ] **Step 1: Open settings.ts**

```bash
code src/convex/settings.ts
```

- [ ] **Step 2: Update the import of PricingGrid (line ~3)**

**Find:**
```typescript
import type { PricingGrid } from "../lib/pricing";
```

(Should already be there. If not, add it.)

- [ ] **Step 3: Find getPricingGrid function (around line 90)**

Look for the function signature:
```typescript
export async function getPricingGrid(
  db: DatabaseReader,
): Promise<PricingGrid | null>
```

No changes needed here — the return type `PricingGrid | null` is already correct (it will now return 3 prices instead of 4, but the interface name stays the same).

- [ ] **Step 4: Find setPricingGrid function (around line 105)**

Look for:
```typescript
export async function setPricingGrid(db: DatabaseWriter, grid: PricingGrid)
```

No changes needed — the function signature is fine; it now accepts the simplified grid.

- [ ] **Step 5: Find updatePricingGrid mutation (around line 136)**

Look for:
```typescript
export const updatePricingGrid = mutation({
  args: {
    generalisteMedecin: v.number(),
    generalisteProfesseur: v.number(),
    specialisteMedecin: v.number(),
    specialisteProfesseur: v.number(),
  },
  async handler(ctx, args) {
    // ...
    await setPricingGrid(ctx.db, {
      generalisteMedecin: args.generalisteMedecin,
      generalisteProfesseur: args.generalisteProfesseur,
      specialisteMedecin: args.specialisteMedecin,
      specialisteProfesseur: args.specialisteProfesseur,
    });
  },
});
```

**Replace with:**
```typescript
export const updatePricingGrid = mutation({
  args: {
    generaliste: v.number(),
    specialiste: v.number(),
    professeur: v.number(),
  },
  async handler(ctx, args) {
    // Require staff role
    const userId = await getAuthUserId(ctx);
    const user = await ctx.db
      .query("users")
      .withIndex("by_id", (q) => q.eq("_id", userId))
      .first();
    if (user?.role !== "staff") {
      throw new Error("Unauthorized: staff role required");
    }

    await setPricingGrid(ctx.db, {
      generaliste: args.generaliste,
      specialiste: args.specialiste,
      professeur: args.professeur,
    });
  },
});
```

- [ ] **Step 6: Type check**

```bash
bun tsc -b --noEmit
```

Expected: No TypeScript errors related to settings.ts.

- [ ] **Step 7: Commit**

```bash
git add src/convex/settings.ts
git commit -m "feat: update pricing grid mutation for 3-category model"
```

---

### Task 5: Create PricingGridManager component (admin UI)

**Files:**
- Create: `src/components/dashboard/PricingGridManager.tsx`

**Interfaces:**
- Consumes: `api.settings.pricingGrid` (query), `api.settings.updatePricingGrid` (mutation)
- Produces: Component `<PricingGridManager />` — displays 3 inputs, "Enregistrer" button

**Context:**
New component for admins to view and edit the 3-price grid. Placed in StaffDoctors. Will query the current grid, allow editing, validate, and save.

- [ ] **Step 1: Create the component file**

```bash
touch src/components/dashboard/PricingGridManager.tsx
```

- [ ] **Step 2: Write the component**

```typescript
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export function PricingGridManager() {
  const grid = useQuery(api.settings.pricingGrid);
  const updateGrid = useMutation(api.settings.updatePricingGrid);

  const [generaliste, setGeneraliste] = useState<string>("");
  const [specialiste, setSpecialiste] = useState<string>("");
  const [professeur, setProfesseur] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Populate fields when grid loads
  useEffect(() => {
    if (grid) {
      setGeneraliste(String(grid.generaliste));
      setSpecialiste(String(grid.specialiste));
      setProfesseur(String(grid.professeur));
    }
  }, [grid]);

  // Validation: check if a value is a valid positive integer
  const isValid = (val: string) => {
    const n = Number(val);
    return Number.isInteger(n) && n > 0;
  };

  const allValid = isValid(generaliste) && isValid(specialiste) && isValid(professeur);

  const handleSave = async () => {
    if (!allValid) {
      toast.error("Tous les prix doivent être des nombres positifs");
      return;
    }

    setIsLoading(true);
    try {
      await updateGrid({
        generaliste: Number(generaliste),
        specialiste: Number(specialiste),
        professeur: Number(professeur),
      });
      toast.success("Grille tarifaire mise à jour");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erreur lors de la sauvegarde",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Grille tarifaire</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Docteur Généraliste
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={generaliste}
              onChange={(e) => setGeneraliste(e.target.value)}
              placeholder="10000"
              className={!isValid(generaliste) && generaliste ? "border-red-500" : ""}
              disabled={isLoading}
            />
            <span className="text-sm text-muted-foreground">FCFA</span>
          </div>
          {!isValid(generaliste) && generaliste && (
            <p className="text-xs text-red-500 mt-1">Prix invalide</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Docteur Spécialiste
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={specialiste}
              onChange={(e) => setSpecialiste(e.target.value)}
              placeholder="20000"
              className={!isValid(specialiste) && specialiste ? "border-red-500" : ""}
              disabled={isLoading}
            />
            <span className="text-sm text-muted-foreground">FCFA</span>
          </div>
          {!isValid(specialiste) && specialiste && (
            <p className="text-xs text-red-500 mt-1">Prix invalide</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Professeur</label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={professeur}
              onChange={(e) => setProfesseur(e.target.value)}
              placeholder="30000"
              className={!isValid(professeur) && professeur ? "border-red-500" : ""}
              disabled={isLoading}
            />
            <span className="text-sm text-muted-foreground">FCFA</span>
          </div>
          {!isValid(professeur) && professeur && (
            <p className="text-xs text-red-500 mt-1">Prix invalide</p>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={!allValid || isLoading}
          className="w-full"
        >
          {isLoading ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Type check**

```bash
bun tsc -b --noEmit
```

Expected: No errors in the new component.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/PricingGridManager.tsx
git commit -m "feat: add PricingGridManager component for admin pricing grid UI"
```

---

### Task 6: Update StaffDoctors form — add category field

**Files:**
- Modify: `src/components/dashboard/StaffDoctors.tsx` (form state and doctor form component)

**Interfaces:**
- Consumes: `category: "generaliste" | "specialiste" | "professeur"` from schema
- Produces: Form state with `category` field, dropdown UI for category selection

**Context:**
The doctor edit form currently has `consultationPrice` and `academicRank` fields. Replace them with a single `category` dropdown. The form state object needs to include `category`.

- [ ] **Step 1: Open StaffDoctors.tsx**

```bash
code src/components/dashboard/StaffDoctors.tsx
```

- [ ] **Step 2: Find the form state interface/object (search for `hasCustomPrice` or similar)**

Look for a state object like:
```typescript
const [form, setForm] = useState<{
  name: string;
  consultationPrice: string;
  hasCustomPrice: boolean;
  // ...
}>({
  consultationPrice: "",
  hasCustomPrice: false,
  // ...
});
```

- [ ] **Step 3: Update the form state to include `category`**

**Add this field to the interface/object:**
```typescript
category: "generaliste" | "specialiste" | "professeur";
```

**Add default value in useState:**
```typescript
category: "specialiste", // default
```

- [ ] **Step 4: Remove `consultationPrice` and `hasCustomPrice` from form state**

Delete these fields from both the interface and the initial state.

- [ ] **Step 5: Remove the academicRank field from form state**

Delete the `academicRank` field as well.

- [ ] **Step 6: Find the form UI (the JSX that renders the doctor form)**

Look for JSX that contains labels like "Tarif personnalisé" or "Grade académique".

- [ ] **Step 7: Replace consultationPrice input with category dropdown**

**Find and remove:**
```typescript
{/* Tarif personnalisé section */}
<div>
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={form.hasCustomPrice}
      onChange={(e) => setForm({ ...form, hasCustomPrice: e.target.checked })}
    />
    Tarif personnalisé
  </label>
  {form.hasCustomPrice && (
    <input
      type="number"
      value={form.consultationPrice}
      onChange={(e) => setForm({ ...form, consultationPrice: e.target.value })}
      placeholder="0"
    />
  )}
</div>
```

**And remove:**
```typescript
{/* academicRank section */}
<select
  value={form.academicRank || ""}
  onChange={(e) => setForm({ ...form, academicRank: e.target.value || undefined })}
>
  {/* ... options */}
</select>
```

**Replace with:**
```typescript
<div>
  <label htmlFor="category" className="block text-sm font-medium mb-2">
    Catégorie tarifaire*
  </label>
  <select
    id="category"
    value={form.category}
    onChange={(e) =>
      setForm({
        ...form,
        category: e.target.value as "generaliste" | "specialiste" | "professeur",
      })
    }
    className="border rounded px-2 py-1 w-full"
  >
    <option value="generaliste">Docteur Généraliste</option>
    <option value="specialiste">Docteur Spécialiste</option>
    <option value="professeur">Professeur</option>
  </select>
</div>
```

- [ ] **Step 8: Update the doctor creation/update mutation call**

Find where the form is submitted (likely in a `handleSave` or similar function). Look for a call like:
```typescript
await createOrUpdateDoctor({
  name: form.name,
  consultationPrice: form.hasCustomPrice ? Number(form.consultationPrice) : undefined,
  academicRank: form.academicRank,
  // ...
});
```

**Replace with:**
```typescript
await createOrUpdateDoctor({
  name: form.name,
  category: form.category,
  // Remove consultationPrice and academicRank
  // ...
});
```

- [ ] **Step 9: Update the form population when editing an existing doctor**

Find where you load a doctor into the form (for edit mode). Look for code like:
```typescript
setForm({
  ...doctor,
  consultationPrice: doctor.consultationPrice ? String(doctor.consultationPrice) : "",
  hasCustomPrice: doctor.consultationPrice != null,
  academicRank: doctor.academicRank,
});
```

**Replace with:**
```typescript
setForm({
  ...doctor,
  category: doctor.category ?? "specialiste",
});
```

- [ ] **Step 10: Type check**

```bash
bun tsc -b --noEmit
```

Expected: No errors related to form state.

- [ ] **Step 11: Commit**

```bash
git add src/components/dashboard/StaffDoctors.tsx
git commit -m "feat: replace consultationPrice + academicRank with category field in doctor form"
```

---

### Task 7: Update StaffDoctors — display tariff in doctor cards

**Files:**
- Modify: `src/components/dashboard/StaffDoctors.tsx` (doctor card rendering)

**Interfaces:**
- Consumes: `doctor.category`, `pricingGrid` query, `resolveConsultationPrice(doctor, grid)`
- Produces: Doctor card displays "Tarif: X FCFA"

**Context:**
Each doctor card should show the tariff based on their category. The tariff comes from the grid. Import the pricing function and call it when rendering.

- [ ] **Step 1: Open StaffDoctors.tsx (if not already open)**

```bash
code src/components/dashboard/StaffDoctors.tsx
```

- [ ] **Step 2: Add import for resolveConsultationPrice**

At the top of the file, find the imports from `@/lib/clinic` and add:
```typescript
import { resolveConsultationPrice } from "@/lib/pricing";
```

- [ ] **Step 3: Query the pricing grid**

Add this query hook at the top of the component function:
```typescript
const pricingGrid = useQuery(api.settings.pricingGrid);
```

(Make sure `api.settings.pricingGrid` is imported in the imports section.)

- [ ] **Step 4: Find the doctor card rendering JSX**

Look for where each doctor is displayed (probably a `doctors.map(...)` or similar). Find the card that shows the doctor's name, specialty, etc.

- [ ] **Step 5: Add tariff display to the card**

Add this line to the card JSX (after phone, before [Éditer] button):
```typescript
<p className="text-sm text-muted-foreground mt-2">
  Tarif: {formatPrice(resolveConsultationPrice(d, pricingGrid))}
</p>
```

(Adjust the exact location based on your card's layout.)

- [ ] **Step 6: Type check**

```bash
bun tsc -b --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/StaffDoctors.tsx
git commit -m "feat: display consultation tariff in doctor cards based on category"
```

---

### Task 8: Add PricingGridManager to StaffDoctors

**Files:**
- Modify: `src/components/dashboard/StaffDoctors.tsx` (add component import and JSX)

**Interfaces:**
- Consumes: `<PricingGridManager />` component from Task 5
- Produces: Grid manager displayed at top of doctor list

**Context:**
Import the PricingGridManager component and render it at the top of StaffDoctors (above the doctor list).

- [ ] **Step 1: Add import**

At the top of StaffDoctors.tsx, add:
```typescript
import { PricingGridManager } from "@/components/dashboard/PricingGridManager";
```

- [ ] **Step 2: Find the JSX that renders the doctor list**

Look for the main return JSX or the section that renders doctors.

- [ ] **Step 3: Add PricingGridManager above the doctor list**

Add this JSX before the list/table:
```typescript
<PricingGridManager />

{/* Rest of doctor list/table goes here */}
```

- [ ] **Step 4: Type check**

```bash
bun tsc -b --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/StaffDoctors.tsx
git commit -m "feat: add PricingGridManager to StaffDoctors admin tab"
```

---

### Task 9: Create PricingGridDisplay component (patient UI)

**Files:**
- Create: `src/components/dashboard/PricingGridDisplay.tsx`

**Interfaces:**
- Consumes: `api.settings.pricingGrid` (query)
- Produces: Component `<PricingGridDisplay />` — read-only 3x2 display of categories and prices

**Context:**
New component for patients to see the pricing grid at the top of the booking flow. Read-only, reactive to grid changes.

- [ ] **Step 1: Create the component file**

```bash
touch src/components/dashboard/PricingGridDisplay.tsx
```

- [ ] **Step 2: Write the component**

```typescript
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { formatPrice } from "@/lib/clinic";
import { useQuery } from "convex/react";

export function PricingGridDisplay() {
  const grid = useQuery(api.settings.pricingGrid);

  if (!grid) return null; // Or show skeleton/loading state

  return (
    <Card className="p-6 mb-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
      <h3 className="text-lg font-semibold mb-4">Tarifs de consultation</h3>
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="font-medium">Docteur Généraliste</span>
          <span>{formatPrice(grid.generaliste)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-medium">Docteur Spécialiste</span>
          <span>{formatPrice(grid.specialiste)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="font-medium">Professeur</span>
          <span>{formatPrice(grid.professeur)}</span>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Type check**

```bash
bun tsc -b --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/PricingGridDisplay.tsx
git commit -m "feat: add PricingGridDisplay component for patient tariff reference"
```

---

### Task 10: Update BookAppointment — add PricingGridDisplay

**Files:**
- Modify: `src/components/dashboard/BookAppointment.tsx` (top of component)

**Interfaces:**
- Consumes: `<PricingGridDisplay />` from Task 9
- Produces: Grid displayed at top of booking flow

**Context:**
Import the PricingGridDisplay and render it at the very top of the BookAppointment component.

- [ ] **Step 1: Open BookAppointment.tsx**

```bash
code src/components/dashboard/BookAppointment.tsx
```

- [ ] **Step 2: Add import**

Add at the top:
```typescript
import { PricingGridDisplay } from "@/components/dashboard/PricingGridDisplay";
```

- [ ] **Step 3: Find the main return JSX**

Look for where the component renders its main content.

- [ ] **Step 4: Add PricingGridDisplay at the very top**

Add this as the first element inside the main container:
```typescript
<PricingGridDisplay />
```

Example structure:
```typescript
return (
  <div className="...">
    <PricingGridDisplay />
    <StepChip step={step} />
    {/* Rest of booking flow */}
  </div>
);
```

- [ ] **Step 5: Type check**

```bash
bun tsc -b --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/dashboard/BookAppointment.tsx
git commit -m "feat: display pricing grid at top of booking flow"
```

---

### Task 11: Update BookAppointment — simplify price calculation calls

**Files:**
- Modify: `src/components/dashboard/BookAppointment.tsx` (price calculation logic)

**Interfaces:**
- Consumes: Updated `resolveConsultationPrice(doctor, grid) → number`
- Produces: Simplified price calculation throughout BookAppointment

**Context:**
The BookAppointment component currently calls `resolveConsultationPrice(selectedDoctor, selectedService, pricingGrid)`. Update all calls to use the new 2-parameter signature: `resolveConsultationPrice(selectedDoctor, pricingGrid)`.

- [ ] **Step 1: Open BookAppointment.tsx**

```bash
code src/components/dashboard/BookAppointment.tsx
```

- [ ] **Step 2: Search for all calls to resolveConsultationPrice**

```bash
grep -n "resolveConsultationPrice" src/components/dashboard/BookAppointment.tsx
```

Expected output: Shows line numbers of each call.

- [ ] **Step 3: Update each call**

**Old pattern:**
```typescript
price: resolveConsultationPrice(selectedDoctor, selectedService, pricingGrid)
```

**New pattern:**
```typescript
price: resolveConsultationPrice(selectedDoctor, pricingGrid)
```

Replace all occurrences.

- [ ] **Step 4: Type check**

```bash
bun tsc -b --noEmit
```

Expected: No errors in BookAppointment.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/BookAppointment.tsx
git commit -m "feat: update resolveConsultationPrice calls to new 2-parameter signature"
```

---

### Task 12: Create migration script

**Files:**
- Create: `src/convex/migrations/migrateDoctorCategories.ts`

**Interfaces:**
- Consumes: Old doctors with `academicRank`, old pricing grid
- Produces: All doctors have `category` field set

**Context:**
One-time script to migrate existing doctors from academicRank → category, and to optionally update the pricing grid. Run this before the schema change is deployed (or right after, depending on deployment strategy).

- [ ] **Step 1: Create migrations directory**

```bash
mkdir -p src/convex/migrations
```

- [ ] **Step 2: Create migration script**

```bash
touch src/convex/migrations/migrateDoctorCategories.ts
```

- [ ] **Step 3: Write the migration**

```typescript
import { mutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * One-time migration: Convert doctor.academicRank + service.isGeneralist → doctor.category
 *
 * Rules:
 * - If academicRank === "professeur" → category = "professeur"
 * - Else if service.isGeneralist === true → category = "generaliste"
 * - Else → category = "specialiste"
 *
 * Run this once after deploying the schema change.
 * After running, you can delete this file.
 */
export const migrateDoctorCategories = mutation({
  args: {},
  async handler(ctx) {
    // Check auth: staff only
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_id", (q) => q.eq("_id", userId.subject))
      .first();
    if (user?.role !== "staff") {
      throw new Error("Unauthorized: staff role required");
    }

    // Fetch all doctors
    const doctors = await ctx.db.query("doctors").collect();

    let migratedCount = 0;

    for (const doctor of doctors) {
      // Skip if already has category (already migrated)
      if ("category" in doctor && doctor.category) {
        continue;
      }

      // Determine category
      let category: "generaliste" | "specialiste" | "professeur" = "specialiste";

      const academicRank = "academicRank" in doctor ? doctor.academicRank : "medecin";
      if (academicRank === "professeur") {
        category = "professeur";
      } else {
        // Fetch the service to check isGeneralist
        const service = await ctx.db.get(doctor.serviceId);
        if (service?.isGeneralist === true) {
          category = "generaliste";
        }
      }

      // Update doctor with category, remove old fields
      await ctx.db.patch(doctor._id, {
        category,
        // Remove old fields if they exist
        // Note: Convex doesn't have an explicit "unset" for optional fields,
        // so we don't explicitly remove academicRank/consultationPrice here.
        // The schema will ignore them on read.
      });

      migratedCount++;
    }

    return {
      success: true,
      migratedCount,
      message: `Migrated ${migratedCount} doctors to new category model`,
    };
  },
});
```

- [ ] **Step 4: Run the migration manually (after deploying schema)**

After deploying the schema change and restarting the dev server, run:
```bash
bun convex run migrateDoctorCategories
```

Expected output: `{ success: true, migratedCount: N, message: "..." }`

- [ ] **Step 5: Verify migration in Convex dashboard**

- Check a few doctors in the Convex dashboard to confirm they have `category` set
- Verify `academicRank` and `consultationPrice` are no longer used

- [ ] **Step 6: Delete the migration file (optional, for cleanup)**

```bash
rm src/convex/migrations/migrateDoctorCategories.ts
```

(You can keep it for reference if desired.)

- [ ] **Step 7: Commit**

```bash
git add src/convex/migrations/migrateDoctorCategories.ts
git commit -m "feat: add migration script for doctor categories"
```

Or, if you delete it:
```bash
git rm src/convex/migrations/migrateDoctorCategories.ts
git commit -m "chore: remove migration script after successful deployment"
```

---

### Task 13: Update pricing tests

**Files:**
- Create or Modify: `src/lib/pricing.test.ts`

**Interfaces:**
- Consumes: `resolveConsultationPrice(doctor, grid)` from Task 3
- Produces: Unit tests covering 3-category logic

**Context:**
Test the simplified pricing function with the new 3-category model. If `pricing.test.ts` doesn't exist, create it.

- [ ] **Step 1: Check if pricing.test.ts exists**

```bash
ls -la src/lib/pricing.test.ts
```

If it exists, open it. If not, create it:
```bash
touch src/lib/pricing.test.ts
```

- [ ] **Step 2: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import {
  resolveConsultationPrice,
  DEFAULT_PRICING_GRID,
  type PricingGrid,
} from "./pricing";

describe("resolveConsultationPrice", () => {
  const testGrid: PricingGrid = {
    generaliste: 10000,
    specialiste: 20000,
    professeur: 30000,
  };

  it("should return price from grid for generaliste", () => {
    const doctor = { category: "generaliste" as const };
    const price = resolveConsultationPrice(doctor, testGrid);
    expect(price).toBe(10000);
  });

  it("should return price from grid for specialiste", () => {
    const doctor = { category: "specialiste" as const };
    const price = resolveConsultationPrice(doctor, testGrid);
    expect(price).toBe(20000);
  });

  it("should return price from grid for professeur", () => {
    const doctor = { category: "professeur" as const };
    const price = resolveConsultationPrice(doctor, testGrid);
    expect(price).toBe(30000);
  });

  it("should use DEFAULT_PRICING_GRID when grid is null", () => {
    const doctor = { category: "specialiste" as const };
    const price = resolveConsultationPrice(doctor, null);
    expect(price).toBe(DEFAULT_PRICING_GRID.specialiste);
  });

  it("should use DEFAULT_PRICING_GRID when grid is undefined", () => {
    const doctor = { category: "generaliste" as const };
    const price = resolveConsultationPrice(doctor, undefined);
    expect(price).toBe(DEFAULT_PRICING_GRID.generaliste);
  });

  it("should handle all three categories correctly", () => {
    const categories = ["generaliste", "specialiste", "professeur"] as const;
    const expectedPrices = [10000, 20000, 30000];

    categories.forEach((cat, idx) => {
      const doctor = { category: cat };
      const price = resolveConsultationPrice(doctor, testGrid);
      expect(price).toBe(expectedPrices[idx]);
    });
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
bun test src/lib/pricing.test.ts
```

Expected output: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pricing.test.ts
git commit -m "test: add unit tests for simplified pricing logic"
```

---

### Task 14: Manual testing — booking flow

**Files:**
- (No code changes; manual UI testing)

**Context:**
Test the complete booking flow to ensure prices are calculated and displayed correctly.

- [ ] **Step 1: Start the dev server**

```bash
bun run dev
```

(Keep `bun convex dev` running in another terminal.)

- [ ] **Step 2: Log in as a patient**

- Open http://localhost:5173/auth
- Sign in with a patient account (or guest)

- [ ] **Step 3: Navigate to "Prendre rendez-vous"**

- Click the booking button
- **Verify:** The pricing grid is displayed at the top (Tarifs de consultation, 3 categories)

- [ ] **Step 4: Select a service and doctor**

- Step 1: Pick a specialty (e.g., Cardiologie)
- Step 2: Pick a doctor
- **Verify:** The doctor's card shows "Tarif: X FCFA" (based on their category)
- **Verify:** The price shown in the booking summary matches the doctor's tariff

- [ ] **Step 5: Complete a mock booking**

- Navigate through all 3 steps
- Confirm the final price is correct
- **Verify:** No errors in browser console

- [ ] **Step 6: Test with multiple doctors in different categories**

- Repeat with a "Généraliste" doctor (should show 10,000 FCFA)
- Repeat with a "Professeur" (should show 30,000 FCFA)
- Verify prices differ correctly

---

### Task 15: Manual testing — admin pricing grid

**Files:**
- (No code changes; manual UI testing)

**Context:**
Test the admin interface for managing the pricing grid.

- [ ] **Step 1: Log in as admin/staff**

- Navigate to Dashboard
- Use staff credentials

- [ ] **Step 2: Go to "Médecins" tab**

- Click the Médecins tab in the dashboard
- **Verify:** The "Grille tarifaire" section is visible at the top

- [ ] **Step 3: View current pricing**

- The 3 input fields should show the current prices
- (Initially should show defaults: 10000, 20000, 30000)

- [ ] **Step 4: Edit and save**

- Change one price (e.g., Généraliste to 12000)
- Click "Enregistrer"
- **Verify:** Toast appears: "Grille tarifaire mise à jour"
- **Verify:** The field value persists (refresh page if needed)

- [ ] **Step 5: Verify changes propagate**

- Go to "Prendre rendez-vous" (patient view)
- **Verify:** The pricing grid displays the new price
- Go back to "Médecins" tab
- **Verify:** Doctor cards show updated tariffs

- [ ] **Step 6: Test validation**

- Try to enter a negative number or non-integer
- **Verify:** Error message appears inline
- **Verify:** "Enregistrer" button is disabled

---

### Task 16: Final verification and cleanup

**Files:**
- (Review and testing only)

**Context:**
Ensure all TypeScript types are correct, no console errors, and the code is clean.

- [ ] **Step 1: Full type check**

```bash
bun tsc -b --noEmit
```

Expected: Zero TypeScript errors.

- [ ] **Step 2: Lint**

```bash
bun run lint
```

Expected: No linting errors related to new code.

- [ ] **Step 3: Test suite**

```bash
bun test
```

Expected: All tests pass (including new pricing tests).

- [ ] **Step 4: Browser console check**

- Open the dev server in browser
- Open DevTools console (F12)
- Navigate through booking and admin flows
- **Verify:** No errors, warnings, or console red flags

- [ ] **Step 5: Verify old fields are gone**

- Search codebase for remaining references to `consultationPrice` or `academicRank`:

```bash
grep -r "consultationPrice\|academicRank" src --include="*.ts" --include="*.tsx" | grep -v "migrations" | grep -v ".test.ts"
```

Expected: Should only appear in comments or migration files, not in active code.

- [ ] **Step 6: Final commit**

If all tests pass and no issues remain:

```bash
git status
```

(Should show clean working directory.)

- [ ] **Step 7: Create summary comment (optional)**

In your git log, all commits should summarize the refactor:

```bash
git log --oneline | head -15
```

Expected output shows commits like:
- "feat: replace academicRank + consultationPrice with category field in doctors schema"
- "feat: simplify PricingGrid and resolveConsultationPrice for 3-category model"
- ... etc.

---

## Self-Review vs. Spec

**Spec coverage check:**

✅ **Section 1: Data Model Changes** → Task 1 (schema), Task 2 (types)  
✅ **Section 2: Admin Interface** → Task 5 (PricingGridManager), Task 8 (add to StaffDoctors)  
✅ **Section 3: Patient Grid Display** → Task 9 (PricingGridDisplay), Task 10 (add to BookAppointment)  
✅ **Section 4: Doctor Cards Tariff** → Task 7 (display tariff)  
✅ **Section 5: Doctor Edit Form** → Task 6 (category field)  
✅ **Section 6: Technical Changes** → Task 3 (pricing.ts), Task 4 (settings.ts), Tasks 11 (update calls)  
✅ **Section 7: Data Migration** → Task 12 (migration script)  
✅ **Section 8: Testing** → Task 13 (unit tests), Tasks 14–16 (manual testing)  

**No gaps detected.**

**Type consistency check:**

- All usages of `category: "generaliste" | "specialiste" | "professeur"` match schema
- All calls to `resolveConsultationPrice(doctor, grid)` use consistent 2-parameter signature
- All form state updates correctly set/read `category` field
- No misnamed functions or inconsistent property names

**Placeholder scan:**

- No "TBD", "TODO", "implement later" anywhere
- All code steps include complete, runnable code
- All validation logic is explicit
- All error messages are in French
- All test cases are concrete

**Scope check:**

- Focused on pricing refactor only (no unrelated refactoring)
- Clear 3-category model, no ambiguity
- Migration strategy is explicit
- Success criteria are testable

---

## Summary

This plan transforms the pricing system from a complex 4-cell grid to a simple, clear 3-category model. Each task is small, independently testable, and includes complete code. The refactor maintains data integrity, adds real-time reactivity via Convex queries, and improves the user experience for both admins (easier to configure) and patients (clearer pricing display).

**Estimated effort:** 2–3 hours for a skilled developer familiar with Convex and React.

**Commits:** ~16 commits, one per task (frequent, atomic commits for easy review and rollback if needed).
