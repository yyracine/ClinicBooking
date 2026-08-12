# Task 12: Create migration script

**Location in plan:** Task 12  
**Depends on:** Task 1 (schema with category field) ✅  
**Effort:** 15 minutes

Create a one-time migration script to convert existing doctors from `academicRank` → `category`.

## What You're Doing

Create a new file: `src/convex/migrations/migrateDoctorCategories.ts`

This script:
- Runs as a mutation (staff-only)
- Fetches all doctors
- For each doctor without a `category` field:
  - If `academicRank === "professeur"` → set `category = "professeur"`
  - Else if `service.isGeneralist === true` → set `category = "generaliste"`
  - Else → set `category = "specialiste"`
- Updates each doctor with the new `category` field
- Returns a summary (count of migrated doctors)

## Complete Script Code

Create `src/convex/migrations/migrateDoctorCategories.ts` with this exact code:

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

## Steps

1. Create the directory: `mkdir -p src/convex/migrations`
2. Create the file: `touch src/convex/migrations/migrateDoctorCategories.ts`
3. Paste the complete script code above into the file
4. Run: `bun tsc -b --noEmit` (should have no errors)
5. Commit: `git add src/convex/migrations/migrateDoctorCategories.ts && git commit -m "feat: add migration script for doctor categories"`

## Manual Execution (Do NOT do this yet)

This script is meant to be run manually after deployment:
```bash
bun convex run migrateDoctorCategories
```

Expected output:
```
{ success: true, migratedCount: N, message: "Migrated N doctors to new category model" }
```

For now, just commit the script. It will be executed later (Task 14+) when we do manual testing.

## Report

Write your report to: `.superpowers/sdd/task-12-report.md`

Include:
- Status: DONE
- Commit hash
- Test summary: "tsc: no errors, migration script created"
