# Task 8: Add PricingGridManager to StaffDoctors

**Location in plan:** Task 8  
**Depends on:** Task 5 (PricingGridManager component) and Task 6 (StaffDoctors updates) — both in progress  
**Effort:** 5 minutes

Import the PricingGridManager component and render it at the top of the StaffDoctors tab.

## What You're Doing

Update `src/components/dashboard/StaffDoctors.tsx`:

1. Import the PricingGridManager component
2. Render it at the top of the component (above the doctor list)

## Code Changes

### Add Import
At the top of `src/components/dashboard/StaffDoctors.tsx`, add:
```typescript
import { PricingGridManager } from "@/components/dashboard/PricingGridManager";
```

### Add to JSX
In the main return JSX of the component (the part that renders the doctor list), add the `<PricingGridManager />` component at the very top, before the doctor list:

```typescript
return (
  <div className="...">
    <PricingGridManager />
    
    {/* Doctor list/table goes here */}
  </div>
);
```

## Steps

1. Open `src/components/dashboard/StaffDoctors.tsx`
2. Add the import for PricingGridManager
3. Find the main JSX return statement that renders the doctor list
4. Add `<PricingGridManager />` at the very top (above the list)
5. Run: `bun tsc -b --noEmit` (should have no errors)
6. Commit: `git add src/components/dashboard/StaffDoctors.tsx && git commit -m "feat: add PricingGridManager to StaffDoctors admin tab"`

## Report

Write your report to: `.superpowers/sdd/task-8-report.md`

Include:
- Status: DONE
- Commit hash
- Test summary: "tsc: no errors, PricingGridManager rendered at top of tab"
