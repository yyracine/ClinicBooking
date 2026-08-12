# Task 3: Update `src/lib/pricing.ts`

**Location in plan:** Task 3  
**Depends on:** Task 1 (schema), Task 2 (types) ✅  
**Effort:** 10 minutes

This task simplifies the pricing logic from a complex 4-cell grid to a simple 3-category lookup. You're replacing the interface, default values, and the `resolveConsultationPrice()` function.

## What You're Doing

Update `src/lib/pricing.ts`:

1. **Replace `PricingGrid` interface** (lines ~34–39)
   - Old: 4 fields (`generalisteMedecin`, `generalisteProfesseur`, `specialisteMedecin`, `specialisteProfesseur`)
   - New: 3 fields (`generaliste`, `specialiste`, `professeur`)

2. **Replace `DEFAULT_PRICING_GRID`** (lines ~42–47)
   - Old: 4 values (10000, 15000, 20000, 30000)
   - New: 3 values (10000, 20000, 30000)

3. **Remove `AcademicRank` type** (line ~31)
   - This type is no longer used

4. **Replace `resolveConsultationPrice()` function** (lines ~59–78)
   - Old: Takes 3 params (doctor, service, grid) with complex branching logic
   - New: Takes 2 params (doctor, grid) with simple category lookup

## Old Code to Replace

### PricingGrid Interface (lines ~34–39)
```typescript
export interface PricingGrid {
  generalisteMedecin: number;
  generalisteProfesseur: number;
  specialisteMedecin: number;
  specialisteProfesseur: number;
}
```

### DEFAULT_PRICING_GRID (lines ~42–47)
```typescript
export const DEFAULT_PRICING_GRID: PricingGrid = {
  generalisteMedecin: 10000,
  generalisteProfesseur: 15000,
  specialisteMedecin: 20000,
  specialisteProfesseur: 30000,
};
```

### AcademicRank Type (line ~31)
```typescript
export type AcademicRank = "medecin" | "professeur";
```

### resolveConsultationPrice Function (lines ~59–78)
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

## New Code to Use

### PricingGrid Interface
```typescript
export interface PricingGrid {
  generaliste: number;
  specialiste: number;
  professeur: number;
}
```

### DEFAULT_PRICING_GRID
```typescript
export const DEFAULT_PRICING_GRID: PricingGrid = {
  generaliste: 10000,
  specialiste: 20000,
  professeur: 30000,
};
```

### AcademicRank Type
**DELETE** this line entirely (no replacement).

### resolveConsultationPrice Function
```typescript
export function resolveConsultationPrice(
  doctor: { category: "generaliste" | "specialiste" | "professeur" },
  grid: PricingGrid | null | undefined,
): number {
  if (!grid) return DEFAULT_PRICING_GRID[doctor.category];
  return grid[doctor.category];
}
```

## Steps

1. Open `src/lib/pricing.ts`
2. Replace PricingGrid interface (exact code above)
3. Replace DEFAULT_PRICING_GRID (exact code above)
4. Delete the AcademicRank type line
5. Replace resolveConsultationPrice function (exact code above)
6. Run: `bun tsc -b --noEmit` (should have no new errors in this file)
7. Commit: `git add src/lib/pricing.ts && git commit -m "feat: simplify PricingGrid and resolveConsultationPrice for 3-category model"`

## Report

Write your report to: `.superpowers/sdd/task-3-report.md`

Include:
- Status: DONE
- Commit hash
- Test summary: "tsc: no errors in pricing.ts" (okay if other files still have errors)
