# Task 4: Update `src/convex/settings.ts`

**Location in plan:** Task 4  
**Depends on:** Task 3 (new PricingGrid interface) ✅  
**Effort:** 10 minutes

Update the settings mutations to handle the new 3-price grid instead of 4-price. The main change is in the `updatePricingGrid` mutation — replace its args from 4 keys to 3 keys.

## What You're Doing

Update the `updatePricingGrid` mutation in `src/convex/settings.ts`:

1. Replace the args definition (4 params → 3 params)
2. Add staff role authorization check
3. Update the call to `setPricingGrid()` with new 3-key grid

The functions `getPricingGrid()` and `setPricingGrid()` don't need changes — they already work with the new interface.

## Old Code to Replace

### updatePricingGrid mutation (around line 136–165)

**Find this:**
```typescript
export const updatePricingGrid = mutation({
  args: {
    generalisteMedecin: v.number(),
    generalisteProfesseur: v.number(),
    specialisteMedecin: v.number(),
    specialisteProfesseur: v.number(),
  },
  async handler(ctx, args) {
    // (existing logic)
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

## Important Notes

- **getPricingGrid()** and **setPricingGrid()** functions don't need changes (they already work with PricingGrid interface)
- The mutation should already have `getAuthUserId` imported; if not, add: `import { getAuthUserId } from "@/convex/auth";`
- The `by_id` index for users should already exist; if the query fails, the auth check will error appropriately

## Steps

1. Open `src/convex/settings.ts`
2. Find the `updatePricingGrid` mutation (around line 136)
3. Replace its `args` definition (4 keys → 3 keys)
4. Add the staff role authorization check in the handler
5. Update the `setPricingGrid()` call to use the new 3-key grid
6. Run: `bun tsc -b --noEmit` (should work without TypeScript errors)
7. Commit: `git add src/convex/settings.ts && git commit -m "feat: update pricing grid mutation for 3-category model"`

## Report

Write your report to: `.superpowers/sdd/task-4-report.md`

Include:
- Status: DONE
- Commit hash
- Test summary: "tsc: no errors in settings.ts"
