# Task 15: Manual testing — admin pricing grid

**Location in plan:** Task 15  
**Depends on:** All admin tasks complete (Tasks 5, 6, 8 fully working)  
**Effort:** 20 minutes (manual UI testing)

Test the admin interface for managing the pricing grid and verify changes propagate to patient views.

## What You're Testing

1. Grille tarifaire (pricing grid) section is visible in the Médecins tab
2. Current prices are displayed
3. Prices can be edited and saved
4. Changes propagate to patient booking view and doctor cards
5. Validation prevents invalid prices

## Test Steps

### Step 1: Start the dev server

```bash
bun run dev
```

(Make sure `bun convex dev` is running in another terminal)

### Step 2: Log in as admin/staff

- Open http://localhost:5173/auth
- Sign in with staff credentials (or use shared staff password)
- Navigate to Dashboard

### Step 3: Go to Médecins tab

- Click the "Médecins" tab
- **Verify:** The "Grille tarifaire" section is visible at the top
- **Verify:** Three input fields are shown with current prices

### Step 4: View current pricing

- **Verify:** Input fields show the default values (or last saved values):
  - Docteur Généraliste: 10000
  - Docteur Spécialiste: 20000
  - Professeur: 30000
- **Verify:** All doctor cards below show tariffs matching these prices

### Step 5: Edit a price

- Change one price (e.g., change "Généraliste" from 10000 to 12000)
- Click "Enregistrer" button
- **Verify:** Toast appears: "Grille tarifaire mise à jour" (success message)
- **Verify:** The field value persists (doesn't revert)

### Step 6: Verify changes propagate

**Check patient booking view:**
- Open a second browser tab or window
- Log in as a patient
- Go to "Prendre rendez-vous"
- **Verify:** Pricing grid at top shows updated price (12000 for Généraliste)

**Check doctor cards:**
- Back in admin tab
- Scroll to doctor list
- **Verify:** All "Docteur Généraliste" cards now show "Tarif: 12000 FCFA"
- **Verify:** Other categories' tariffs match new grid

### Step 7: Test validation

- Try to enter an invalid price (negative number or non-integer)
- **Verify:** Error message appears inline: "Prix invalide"
- **Verify:** "Enregistrer" button is disabled (greyed out)
- Clear the invalid value
- **Verify:** Button becomes enabled again

### Step 8: Test with multiple price changes

- Change all three prices (e.g., 11000, 21000, 31000)
- Click "Enregistrer"
- **Verify:** Success toast
- **Verify:** All doctor cards update immediately
- Go back to patient booking view
- **Verify:** Grid shows new prices

### Step 9: Console check

- Open DevTools (F12)
- Perform the edit and save operations above
- **Verify:** No red errors in console
- **Verify:** No TypeScript issues

## Report

Write your report to: `.superpowers/sdd/task-15-report.md`

Include:
- Status: DONE (or BLOCKED if issues found)
- Test results: What did you verify?
- Any issues: (list any console errors or unexpected behavior)
- Examples: "Edited Généraliste price to 12000 → saved ✓ → updated on patient view ✓"

## Success Criteria

✅ Grille tarifaire visible in Médecins tab  
✅ Current prices displayed correctly  
✅ Prices can be edited and saved  
✅ Changes propagate to patient view  
✅ Changes propagate to doctor cards  
✅ Validation prevents invalid prices  
✅ No console errors  
