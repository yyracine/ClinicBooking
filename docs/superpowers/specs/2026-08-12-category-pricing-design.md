# Pricing System Refactor: Category-Based Tarification

**Date:** 2026-08-12  
**Project:** ClinicBooking  
**Status:** Design Approved

## Executive Summary

Refactor the consultation pricing system from a complex 4-cell grid (2×2: medecin/professeur × generalist/specialist) to a simple 3-category model: **Docteur Généraliste**, **Docteur Spécialiste**, and **Professeur**. Each doctor has exactly one category; the consultation price is determined entirely by that category.

**Goals:**
- Simplify pricing logic (remove academicRank + consultationPrice fields)
- Make tariffs visible to patients at booking time
- Make tariffs visible in doctor cards (StaffDoctors tab)
- Allow admin to manage the 3-price grid from the Médecins tab

---

## 1. Data Model Changes

### 1.1 Schema: `doctors` table

**Remove these fields:**
- `consultationPrice: v.optional(v.number())` — no more per-doctor price overrides
- `academicRank: v.optional(v.union(v.literal("medecin"), v.literal("professeur")))` — replaced by `category`

**Add this field:**
```typescript
category: v.union(
  v.literal("generaliste"),
  v.literal("specialiste"),
  v.literal("professeur")
),
```

- **Required:** Yes (every doctor must have a category)
- **Default:** None (must be explicitly set during creation/edit)
- **Cardinality:** One category per doctor (1:1)

### 1.2 Pricing Grid: Simplified structure

**Current (in `src/lib/pricing.ts`):**
```typescript
export interface PricingGrid {
  generalisteMedecin: number;
  generalisteProfesseur: number;
  specialisteMedecin: number;
  specialisteProfesseur: number;
}
```

**New:**
```typescript
export interface PricingGrid {
  generaliste: number;
  specialiste: number;
  professeur: number;
}

export const DEFAULT_PRICING_GRID: PricingGrid = {
  generaliste: 10000,   // Docteur Généraliste
  specialiste: 20000,   // Docteur Spécialiste
  professeur: 30000,    // Professeur
};
```

### 1.3 Price Resolution Function

**Current:**
```typescript
export function resolveConsultationPrice(
  doctor: { consultationPrice?: number; academicRank?: AcademicRank },
  service: { price: number; isGeneralist?: boolean },
  grid: PricingGrid | null | undefined,
): number
```

**New:**
```typescript
export function resolveConsultationPrice(
  doctor: { category: "generaliste" | "specialiste" | "professeur" },
  grid: PricingGrid | null | undefined,
): number {
  if (!grid) return DEFAULT_PRICING_GRID[doctor.category];
  return grid[doctor.category];
}
```

- **Logic:** Direct lookup: `grid[doctor.category]` → no fallback to service price
- **Fallback:** If grid is null/undefined, use `DEFAULT_PRICING_GRID`
- **No override:** Consultation price is **always** determined by category + grid

---

## 2. Admin Interface: Pricing Grid Manager

### 2.1 Location
- **Component:** `src/components/dashboard/StaffDoctors.tsx`
- **Placement:** New section "Grille tarifaire" above or below doctor list
- **Visibility:** Staff/admin only (RoleGate: staff)

### 2.2 UI Layout
```
┌──────────────────────────────────────┐
│ Grille tarifaire                     │
├──────────────────────────────────────┤
│ Docteur Généraliste                  │
│ [10000 FCFA input field]              │
│                                      │
│ Docteur Spécialiste                  │
│ [20000 FCFA input field]              │
│                                      │
│ Professeur                           │
│ [30000 FCFA input field]              │
│                                      │
│                      [Enregistrer]    │
└──────────────────────────────────────┘
```

### 2.3 Behavior

**On load:**
- Call `api.settings.pricingGrid` query
- Populate inputs with current values
- If no grid saved, show `DEFAULT_PRICING_GRID`

**On change:**
- User edits any field → preview updates immediately
- Click "Enregistrer" → call `updatePricingGrid` mutation
- On success: toast "Grille tarifaire mise à jour"
- On error: toast "Erreur lors de la sauvegarde"

**Validation:**
- Each field must be > 0 (positive integer)
- Show inline error if invalid
- "Enregistrer" button disabled if any field is invalid

**Real-time updates:**
- After mutation succeeds, the query automatically re-runs (Convex reactivity)
- All components using `pricingGrid` query (BookAppointment, StaffDoctors cards) update instantly

---

## 3. Patient Experience: Pricing Grid Display

### 3.1 Location
- **Component:** `src/components/dashboard/BookAppointment.tsx`
- **Placement:** Top of the component (above "Étape 1: Choisissez un service")

### 3.2 UI Layout
```
┌──────────────────────────────────────┐
│ Tarifs de consultation               │
├──────────────────────────────────────┤
│ Docteur Généraliste    10 000 FCFA   │
│ Docteur Spécialiste    20 000 FCFA   │
│ Professeur             30 000 FCFA   │
└──────────────────────────────────────┘

[Step flow continues below...]
```

### 3.3 Behavior

**On load:**
- Call `api.settings.pricingGrid` query
- Display the 3 categories + prices
- If no grid saved, show `DEFAULT_PRICING_GRID`

**Updates:**
- If admin updates the grid, this display updates automatically (same query)

**Non-interactive:**
- Read-only display (no buttons, inputs, or actions)

---

## 4. Doctor Cards: Display Tariff

### 4.1 Location
- **Component:** `src/components/dashboard/StaffDoctors.tsx`
- **Placement:** In each doctor card, alongside name, specialty, bio, phone

### 4.2 UI Layout (per doctor)
```
┌──────────────────────────────────┐
│ Dr. Jean Dupont                  │
│ Cardiologie • Docteur Spécialiste│
│ Cardiologue expérimenté...       │
│ 📞 +235 66 12 34 56              │
│ Tarif: 20 000 FCFA               │ ← NEW
│                                  │
│ [Éditer] [Supprimer]             │
└──────────────────────────────────┘
```

### 4.3 Behavior

**Tariff display logic:**
```typescript
const price = resolveConsultationPrice(doctor, grid);
// Render: `Tarif: {formatPrice(price)}`
```

**Updates:**
- When admin updates the grid, all doctor cards re-render with new prices
- When a doctor's category changes, their card shows new price immediately

---

## 5. Doctor Edit Form: Category Assignment

### 5.1 Location
- **Component:** `src/components/dashboard/StaffDoctors.tsx`
- **Form:** Existing "Éditer un médecin" dialog/form

### 5.2 Fields

**Add this field:**
```
Catégorie tarifaire* [Dropdown]
  ○ Docteur Généraliste
  ○ Docteur Spécialiste  (default)
  ○ Professeur
```

**Remove these fields:**
- `Tarif personnalisé` (was `consultationPrice`)
- `Grade académique` (was `academicRank`)

### 5.3 Form State & Validation

**Form structure (in StaffDoctors state):**
```typescript
interface DoctorFormState {
  name: string;
  firstName?: string;
  lastName?: string;
  serviceId: Id<"services">;
  title: string;
  bio: string;
  phone?: string;
  category: "generaliste" | "specialiste" | "professeur"; // NEW
  schedule?: Schedule[];
  color: string;
}
```

**Validation:**
- `category` is **required** (must be set)
- Show error if trying to save with empty category

**Creation:**
- Default `category` to "specialiste" (or let user choose)

**Edit:**
- Load existing `category` from doctor record
- Allow change to any of the 3 options

### 5.4 Mutation

**Call:** `api.doctors.updateDoctor(id, { name, firstName, ..., category, ... })`
- Remove `consultationPrice` from payload (no longer exists)
- Remove `academicRank` from payload (replaced by `category`)
- Include `category` in payload

---

## 6. Data Migration Strategy

### 6.1 Existing Doctors

**Scenario:** Clinic has existing doctors with `academicRank` and/or `consultationPrice`.

**Migration approach:**

For each doctor:
1. Read `academicRank` (default "medecin" if not set) and `service.isGeneralist`
2. Map to new `category`:
   - If `academicRank === "professeur"` → `category = "professeur"`
   - Else if `service.isGeneralist === true` → `category = "generaliste"`
   - Else → `category = "specialiste"`
3. Discard `consultationPrice` (no longer used)

**Migration timing:**
- One-time script (Convex action or manual DB update)
- Run before deploying the UI changes
- Verify all doctors have a valid `category` post-migration

### 6.2 Pricing Grid

**Current grid** (if custom grid was saved):
```json
{
  "generalisteMedecin": 10000,
  "generalisteProfesseur": 15000,
  "specialisteMedecin": 20000,
  "specialisteProfesseur": 30000
}
```

**Map to new grid:**
```json
{
  "generaliste": 10000,      // avg or max of generalisteMedecin/Professeur
  "specialiste": 20000,      // avg or max of specialisteMedecin/Professeur
  "professeur": 22500        // avg of generalisteProfesseur/specialisteProfesseur
}
```

Or simpler: use `DEFAULT_PRICING_GRID` and let admin set new values.

---

## 7. Code Changes: File-by-File

### 7.1 `src/convex/schema.ts`
- Update `doctors` table definition
- Remove `consultationPrice` and `academicRank`
- Add `category` field (required, union literal)

### 7.2 `src/lib/pricing.ts`
- Update `PricingGrid` interface (3 fields instead of 4)
- Update `DEFAULT_PRICING_GRID` values
- Simplify `resolveConsultationPrice()` function
- Remove `AcademicRank` type (no longer needed)

### 7.3 `src/convex/settings.ts`
- Update `getPricingGrid()` return type
- Update `setPricingGrid()` parameter type
- Update `updatePricingGrid` mutation to handle 3 prices instead of 4
- Update any default value handling

### 7.4 `src/components/dashboard/StaffDoctors.tsx`
- Add `PricingGridManager` component (new section at top/bottom)
- Add `category` field to doctor form
- Remove `consultationPrice` and `academicRank` fields from form
- Update doctor card to display tariff: `resolveConsultationPrice(doctor, grid)`
- Update `getDoctorPrice()` or similar helper calls to pass only `doctor` and `grid`

### 7.5 `src/components/dashboard/BookAppointment.tsx`
- Add `PricingGridDisplay` component at top (read-only grid)
- Update `resolveConsultationPrice()` calls to pass only `doctor` and `grid`
- Remove usage of `service.isGeneralist` in price calculation
- Remove `doctor.academicRank` from any logic

### 7.6 `src/convex/appointments.ts` (if needed)
- Review any price-related logic
- Ensure `resolveConsultationPrice()` is called correctly with new signature

### 7.7 Type regeneration
- After schema changes, run:
  ```bash
  bun convex dev --once
  bun tsc -b --noEmit
  ```

---

## 8. Testing Strategy

### 8.1 Unit Tests
- `src/lib/pricing.test.ts`: Test `resolveConsultationPrice()` with 3 categories
- Test with `grid === null` (fallback to default)
- Test with partial/invalid grid (edge cases)

### 8.2 Integration Tests
- StaffDoctors: Can create/edit doctor with category
- StaffDoctors: Can update pricing grid
- BookAppointment: Grid displays correctly
- BookAppointment: Doctor cards show correct price based on category
- Verify prices update in real-time when grid changes

### 8.3 Manual Testing
- Create a doctor in each category
- Update grid → verify prices change on cards and booking page
- Create an appointment → verify price is calculated correctly
- Test patient flow: see grid at top, select doctor, confirm price is correct

---

## 9. Rollout & Cleanup

### 9.1 Pre-deployment
- [ ] Run migration script (academicRank → category)
- [ ] Verify all doctors have a valid category
- [ ] Backup current pricing grid (in case rollback needed)

### 9.2 Deployment
- [ ] Deploy schema changes
- [ ] Regenerate TypeScript types
- [ ] Deploy UI changes
- [ ] Verify BookAppointment loads without error
- [ ] Verify StaffDoctors admin interface works

### 9.3 Post-deployment
- [ ] Test patient booking flow end-to-end
- [ ] Verify prices display correctly
- [ ] Verify admin can edit grid
- [ ] Monitor error logs for any `resolveConsultationPrice()` failures

---

## 10. Success Criteria

✅ Patients see the 3-category pricing grid before booking  
✅ Doctor cards display tariff based on category  
✅ Admin can update the 3 prices from Médecins tab  
✅ Price changes are reflected instantly across the app  
✅ No more per-doctor price overrides  
✅ Code is simpler and more maintainable  
✅ All existing doctors migrate successfully to new category system  
✅ No breaking changes to API or frontend logic
