# Task 7: Update StaffDoctors — display tariff in doctor cards

**Location in plan:** Task 7  
**Depends on:** Task 3 (resolveConsultationPrice) ✅ and Task 6 (category field in form) — in progress  
**Effort:** 10 minutes

Add a tariff line to each doctor card showing the consultation price based on the doctor's category.

## What You're Doing

Update the doctor card rendering in `src/components/dashboard/StaffDoctors.tsx`:

1. Import `resolveConsultationPrice` from `@/lib/pricing`
2. Query the pricing grid using `useQuery(api.settings.pricingGrid)`
3. Add a tariff display line to each doctor card: "Tarif: {price} FCFA"

## Code Changes

### Add Import
At the top of `src/components/dashboard/StaffDoctors.tsx`, add:
```typescript
import { resolveConsultationPrice } from "@/lib/pricing";
```

### Query Pricing Grid
In the component function, add this hook:
```typescript
const pricingGrid = useQuery(api.settings.pricingGrid);
```

### Add to Doctor Card JSX
In the doctor card rendering (where each doctor is displayed), add this line after the phone number and before the [Éditer] button:

```typescript
<p className="text-sm text-muted-foreground mt-2">
  Tarif: {formatPrice(resolveConsultationPrice(doctor, pricingGrid))}
</p>
```

Make sure `formatPrice` is already imported from `@/lib/clinic` (it should be).

## Important Notes

- The `resolveConsultationPrice()` function now takes 2 params: `doctor` (with `category` field) and `grid`
- The price updates reactively when the grid changes (Convex query reactivity)
- All doctor objects should have the `category` field from Task 6

## Steps

1. Open `src/components/dashboard/StaffDoctors.tsx`
2. Add the import for `resolveConsultationPrice`
3. Add the `pricingGrid` query hook
4. Find the doctor card JSX (where each doctor is displayed)
5. Add the tariff display line (exact code above)
6. Run: `bun tsc -b --noEmit` (should resolve some TypeScript errors)
7. Commit: `git add src/components/dashboard/StaffDoctors.tsx && git commit -m "feat: display consultation tariff in doctor cards based on category"`

## Report

Write your report to: `.superpowers/sdd/task-7-report.md`

Include:
- Status: DONE
- Commit hash
- Test summary: "tsc: tariff display added to doctor cards"
