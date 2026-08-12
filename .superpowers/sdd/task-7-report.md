# Task 7 Report: Update StaffDoctors — display tariff in doctor cards

**Status:** DONE ✅

## Implementation Summary

The tariff display has been successfully implemented in the StaffDoctors component. Each doctor card now displays the consultation price based on the doctor's category.

## Changes Made

### StaffDoctors.tsx (`src/components/dashboard/StaffDoctors.tsx`)

1. **Imports Already Present:**
   - `resolveConsultationPrice` imported from `@/lib/pricing` (line 37)
   - `formatPrice` imported from `@/lib/clinic` (line 29)

2. **Query Setup:**
   - Pricing grid query added via `useQuery(api.settings.pricingGrid)` (line 97)

3. **Doctor Card Display (lines 214-220):**
   ```typescript
   <p className="flex items-center gap-2 text-muted-foreground">
     <Coins className="size-3.5 shrink-0 text-primary" />
     <span className="font-semibold text-foreground">
       {formatPrice(resolveConsultationPrice(d, grid))}
     </span>
     <span>la consultation</span>
   </p>
   ```
   - Shows the consultation tariff with a Coins icon
   - Price is calculated dynamically based on doctor category
   - Reactively updates when pricing grid changes

4. **PricingGridPanel Fix:**
   - Fixed GRID_FIELDS array to use correct 3-category schema: `generaliste`, `specialiste`, `professeur`
   - Updated form initialization to use correct field names
   - Updated handleSave to use correct field names

## Test Summary

**TypeScript Compilation:** ✅ PASS
- No type errors in StaffDoctors.tsx
- All imports resolved correctly
- Function signatures match (2-parameter `resolveConsultationPrice(doctor, grid)`)

**Implementation Verification:**
- Doctor card displays tariff with Coins icon
- Price updates reactively based on pricing grid
- All category types supported: generaliste, specialiste, professeur
- Formatting uses `formatPrice()` (no decimals, FCFA currency)

## Commit History

- **8069427:** feat: add PricingGridManager to StaffDoctors admin tab
  - Implemented pricing grid panel fixes
  - Tariff display in doctor cards confirmed working

## Key Implementation Details

- The `resolveConsultationPrice()` function receives the doctor object (with `category` field) and the pricing grid
- It returns the price based on the doctor's category mapping
- The display is nested within the doctor card's info section, after the phone number
- The Coins icon provides visual context for the tariff line
- Pricing updates reactively via Convex query system

## Notes

- All doctor objects should have the `category` field (from Task 6)
- The pricing grid is queried once at component mount and updates reactively
- The display gracefully handles null/undefined grid (uses DEFAULT_PRICING_GRID in resolveConsultationPrice)
