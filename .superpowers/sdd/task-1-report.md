# Task 1: Update `doctors` schema — Report

## Status
**DONE_WITH_CONCERNS**

## Commits
`718e247`

## Test Summary
Schema change completed successfully. TypeScript compilation shows 16 errors in dependent code (expected, as this task blocks others):
- `src/components/dashboard/BookAppointment.tsx` (2 errors)
- `src/components/dashboard/StaffDoctors.tsx` (3 errors)
- `src/convex/appointments.ts` (4 errors)
- `src/convex/doctors.ts` (2 errors)
- `src/convex/payments.ts` (2 errors)
- `src/convex/seed.ts` (2 errors)

## What Was Done
Successfully replaced the `doctors` schema definition:
- Removed: `consultationPrice: v.optional(v.number())`
- Removed: `academicRank: v.optional(v.union(v.literal("medecin"), v.literal("professeur")))`
- Added: `category: v.union(v.literal("generaliste"), v.literal("specialiste"), v.literal("professeur"))` (required field)

## Concerns
Multiple files reference the removed fields and need updates:
1. **`src/convex/appointments.ts`** — Uses `doctor.consultationPrice` and `doctor.academicRank` for pricing logic (lines 155–156, 215–216)
2. **`src/convex/doctors.ts`** — Creates/updates doctors with `consultationPrice` field (lines 130, 180)
3. **`src/convex/payments.ts`** — References pricing fields (line 97, 277)
4. **`src/convex/seed.ts`** — Seed data includes `consultationPrice` field (line 322)
5. **`src/components/dashboard/BookAppointment.tsx`** — Passes doctor data expecting old fields (lines 181, 606)
6. **`src/components/dashboard/StaffDoctors.tsx`** — Renders/edits doctor fields (lines 226, 235, 245)

These errors are expected for a blocking schema task. Subsequent tasks should:
- Update all references to use the new `category` field
- Update pricing logic to derive consultation price from `category` (instead of per-doctor `consultationPrice`)
- Update seed data and create/update flows to provide the required `category` field
