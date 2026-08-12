# Task 13: Update pricing tests

**Location in plan:** Task 13  
**Depends on:** Task 3 (new resolveConsultationPrice function) ✅  
**Effort:** 15 minutes

Write or update unit tests for the simplified pricing logic.

## What You're Doing

Create or update `src/lib/pricing.test.ts`:

1. Test that `resolveConsultationPrice()` returns the correct price for each category
2. Test that it falls back to DEFAULT_PRICING_GRID when grid is null/undefined
3. Test all three categories with the same grid

## Complete Test Code

Write this to `src/lib/pricing.test.ts`:

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

## Steps

1. Check if `src/lib/pricing.test.ts` exists
2. If it exists, open it; if not, create it: `touch src/lib/pricing.test.ts`
3. Paste the complete test code above into the file
4. Run: `bun test src/lib/pricing.test.ts` (all 6 tests should pass)
5. Run: `bun tsc -b --noEmit` (no TypeScript errors)
6. Commit: `git add src/lib/pricing.test.ts && git commit -m "test: add unit tests for simplified pricing logic"`

## Expected Test Output

```
✓ resolveConsultationPrice (6)
  ✓ should return price from grid for generaliste
  ✓ should return price from grid for specialiste
  ✓ should return price from grid for professeur
  ✓ should use DEFAULT_PRICING_GRID when grid is null
  ✓ should use DEFAULT_PRICING_GRID when grid is undefined
  ✓ should handle all three categories correctly

Test Files  1 passed (1)
     Tests  6 passed (6)
```

## Report

Write your report to: `.superpowers/sdd/task-13-report.md`

Include:
- Status: DONE
- Commit hash
- Test summary: "6/6 tests passing"
