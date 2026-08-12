# Task 10: Update BookAppointment — add PricingGridDisplay

**Location in plan:** Task 10  
**Depends on:** Task 9 (PricingGridDisplay component) — in progress  
**Effort:** 5 minutes

Import the PricingGridDisplay component and render it at the very top of the booking flow.

## What You're Doing

Update `src/components/dashboard/BookAppointment.tsx`:

1. Import the PricingGridDisplay component
2. Render it at the very top of the component (before any booking steps)

## Code Changes

### Add Import
At the top of `src/components/dashboard/BookAppointment.tsx`, add:
```typescript
import { PricingGridDisplay } from "@/components/dashboard/PricingGridDisplay";
```

### Add to JSX
In the main return JSX of the component, add `<PricingGridDisplay />` as the first element inside the container:

```typescript
return (
  <div className="...">
    <PricingGridDisplay />
    
    {/* Rest of booking flow (step chips, etc.) */}
  </div>
);
```

The grid should appear above the step indicator, form, and all other content.

## Steps

1. Open `src/components/dashboard/BookAppointment.tsx`
2. Add the import for PricingGridDisplay
3. Find the main JSX return statement
4. Add `<PricingGridDisplay />` as the first element inside the main container
5. Run: `bun tsc -b --noEmit` (should have no errors)
6. Commit: `git add src/components/dashboard/BookAppointment.tsx && git commit -m "feat: display pricing grid at top of booking flow"`

## Report

Write your report to: `.superpowers/sdd/task-10-report.md`

Include:
- Status: DONE
- Commit hash
- Test summary: "tsc: no errors, PricingGridDisplay rendered at top of booking"
