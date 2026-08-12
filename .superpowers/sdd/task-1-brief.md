# Task 1: Update `doctors` schema

**Location in plan:** Task 1 (schema changes)  
**Estimated effort:** 5 minutes

This is the first task. It makes a critical schema change that blocks all other tasks. You're replacing two optional fields (`academicRank`, `consultationPrice`) with a single required field (`category`).

## What You're Doing

Update the `doctors` table in `src/convex/schema.ts`:

1. Remove: `academicRank: v.optional(v.union(v.literal("medecin"), v.literal("professeur")))`
2. Remove: `consultationPrice: v.optional(v.number())`
3. Add: `category: v.union(v.literal("generaliste"), v.literal("specialiste"), v.literal("professeur"))`

The new field is **required** (no `.optional()`) — every doctor must have a category.

## Files You'll Touch

- **Modify:** `src/convex/schema.ts` (lines ~71–95, the `doctors` table definition)

## Exact Code to Replace

**Find this (current code, around lines 71–104):**
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

## Steps

1. Open `src/convex/schema.ts`
2. Find the `doctors` table (around line 71)
3. Delete the two old fields
4. Add the new `category` field (exact code above)
5. Run: `bun tsc -b --noEmit` to verify no TypeScript errors
6. Commit: `git add src/convex/schema.ts && git commit -m "feat: replace academicRank + consultationPrice with category field in doctors schema"`

## Report

Write your report to: `.superpowers/sdd/task-1-report.md`

Include:
- Status (DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, BLOCKED)
- Commits (hash range, e.g., abc1234..def5678)
- Test summary (e.g., "No TypeScript errors after schema update")
- Any self-review notes
