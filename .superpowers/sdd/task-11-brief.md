# Task 11: Update BookAppointment — simplify price calculation calls

**Location in plan:** Task 11  
**Depends on:** Task 3 (new resolveConsultationPrice signature) ✅ and Task 10 (grid display) — in progress  
**Effort:** 10 minutes

Update all calls to `resolveConsultationPrice()` in BookAppointment to use the new 2-parameter signature (removed `service` parameter).

## What You're Doing

Find all calls to `resolveConsultationPrice()` in `src/components/dashboard/BookAppointment.tsx` and update them from 3 parameters to 2 parameters.

## Old vs New Pattern

### Old (3 parameters)
```typescript
price: resolveConsultationPrice(selectedDoctor, selectedService, pricingGrid)
```

### New (2 parameters)
```typescript
price: resolveConsultationPrice(selectedDoctor, pricingGrid)
```

Simply remove the `selectedService` (or equivalent) parameter from every call.

## How to Find All Calls

Run this command to find all occurrences:
```bash
grep -n "resolveConsultationPrice" src/components/dashboard/BookAppointment.tsx
```

This will show you the line numbers where the function is called.

## Steps

1. Open `src/components/dashboard/BookAppointment.tsx`
2. Run: `grep -n "resolveConsultationPrice" src/components/dashboard/BookAppointment.tsx`
3. For each line number shown, go to that line and remove the `service` parameter from the call
4. Pattern: Replace `resolveConsultationPrice(doctor, service, grid)` with `resolveConsultationPrice(doctor, grid)`
5. Run: `bun tsc -b --noEmit` (should resolve more TypeScript errors)
6. Commit: `git add src/components/dashboard/BookAppointment.tsx && git commit -m "feat: update resolveConsultationPrice calls to new 2-parameter signature"`

## Report

Write your report to: `.superpowers/sdd/task-11-report.md`

Include:
- Status: DONE
- Commit hash
- Test summary: "tsc: all resolveConsultationPrice calls updated"
- Number of calls updated: X
