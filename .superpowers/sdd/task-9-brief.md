# Task 9: Create PricingGridDisplay component (patient UI)

**Location in plan:** Task 9  
**Depends on:** Task 4 (settings queries) — in progress  
**Effort:** 10 minutes

Create a read-only component for patients to see the pricing grid at the top of the booking flow.

## What You're Doing

Create a new file: `src/components/dashboard/PricingGridDisplay.tsx`

This component:
- Queries the pricing grid using `api.settings.pricingGrid`
- Displays the 3 categories and their prices in a read-only format
- Uses a blue-tinted Card for visibility
- Is non-interactive (no buttons, inputs, or actions)
- Updates reactively when the grid changes

## Complete Component Code

Write this complete component to `src/components/dashboard/PricingGridDisplay.tsx`:

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

## Key Points

- Uses `formatPrice()` from `@/lib/clinic` for FCFA formatting (no decimals)
- Queries `api.settings.pricingGrid` which is reactive (auto-updates when grid changes)
- Returns `null` if grid is not loaded yet (safe fallback)
- Blue styling with `bg-blue-50 dark:bg-blue-950` for visibility and dark mode support

## Steps

1. Create file: `touch src/components/dashboard/PricingGridDisplay.tsx`
2. Paste the complete component code above into the file
3. Run: `bun tsc -b --noEmit` (should have no errors)
4. Commit: `git add src/components/dashboard/PricingGridDisplay.tsx && git commit -m "feat: add PricingGridDisplay component for patient tariff reference"`

## Report

Write your report to: `.superpowers/sdd/task-9-report.md`

Include:
- Status: DONE
- Commit hash
- Test summary: "tsc: no errors, component created and type-safe"
