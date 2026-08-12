# Task 14: Manual testing — booking flow

**Location in plan:** Task 14  
**Depends on:** All UI tasks complete (Tasks 6, 10, 11 fully working)  
**Effort:** 20 minutes (manual UI testing)

Test the complete booking flow end-to-end to verify prices are calculated and displayed correctly.

## What You're Testing

1. Pricing grid is visible at the top of booking
2. Doctor cards show the tariff based on their category
3. Prices update correctly when doctors with different categories are selected
4. No console errors during the flow

## Test Steps

### Step 1: Start the dev server

```bash
bun run dev
```

(Make sure `bun convex dev` is also running in another terminal)

### Step 2: Log in as a patient

- Open http://localhost:5173/auth
- Sign in with a patient account (or use guest login)

### Step 3: Navigate to booking

- Click "Prendre rendez-vous" or equivalent booking button
- **Verify:** The pricing grid is displayed at the top
  - Should show: "Tarifs de consultation"
  - Should list: "Docteur Généraliste", "Docteur Spécialiste", "Professeur" with prices
  - Should show default prices: 10000, 20000, 30000 (unless admin changed them)

### Step 4: Select a service and doctor

- Step 1: Pick a specialty (e.g., Cardiologie)
- Step 2: Pick a doctor
- **Verify:** The doctor's card shows "Tarif: X FCFA"
- **Verify:** The price matches the expected tariff for that doctor's category
- **Verify:** No errors in the browser console (F12)

### Step 5: Test with multiple doctors

- Go back to Step 2
- Select different doctors from different categories:
  - Select a "Docteur Généraliste" → verify price is 10000 FCFA
  - Select a "Docteur Spécialiste" → verify price is 20000 FCFA
  - Select a "Professeur" → verify price is 30000 FCFA
- **Verify:** Prices differ correctly between categories

### Step 6: Complete a booking attempt

- Navigate through all 3 booking steps
- At the final summary, verify the total price is correct
- **Verify:** No console errors

### Step 7: Open browser console (F12)

- Look for any red errors or TypeScript issues
- **Verify:** No "cannot read property 'category'" errors
- **Verify:** No "resolveConsultationPrice is not a function" errors

## Report

Write your report to: `.superpowers/sdd/task-14-report.md`

Include:
- Status: DONE (or BLOCKED if issues found)
- Test results: What did you verify?
- Any issues encountered: (list any console errors or unexpected behavior)
- Examples: "Selected Dr. Dupont (Specialist) → showed 20000 FCFA ✓"

## Success Criteria

✅ Pricing grid visible at top of booking  
✅ Doctor tariffs displayed on cards  
✅ Tariffs match expected values based on category  
✅ Multiple doctors tested with different categories  
✅ No console errors  
