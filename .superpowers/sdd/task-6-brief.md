# Task 6: Update StaffDoctors form — add category field

**Location in plan:** Task 6  
**Depends on:** Task 2 (types) ✅  
**Effort:** 15 minutes

Replace the old doctor form fields (`consultationPrice`, `hasCustomPrice`, `academicRank`) with a single `category` dropdown.

## What You're Doing

Update the doctor edit/create form in `src/components/dashboard/StaffDoctors.tsx`:

1. Add `category: "generaliste" | "specialiste" | "professeur"` to form state (default "specialiste")
2. Remove `consultationPrice`, `hasCustomPrice`, and `academicRank` from form state
3. Replace the price/rank input fields with a category dropdown
4. Update form submission to pass `category` instead of old fields
5. Update form population when editing to load existing `category`

## Form State Changes

### Old Structure
```typescript
const [form, setForm] = useState({
  // ... other fields ...
  consultationPrice: "",
  hasCustomPrice: false,
  academicRank: undefined,
});
```

### New Structure
```typescript
const [form, setForm] = useState({
  // ... other fields ...
  category: "specialiste", // default
});
```

## UI Changes

### Remove These JSX Sections
- Checkbox for "Tarif personnalisé"
- Number input for consultation price
- Dropdown/select for "Grade académique"

### Add This Category Dropdown
```typescript
<div>
  <label htmlFor="category" className="block text-sm font-medium mb-2">
    Catégorie tarifaire*
  </label>
  <select
    id="category"
    value={form.category}
    onChange={(e) =>
      setForm({
        ...form,
        category: e.target.value as "generaliste" | "specialiste" | "professeur",
      })
    }
    className="border rounded px-2 py-1 w-full"
  >
    <option value="generaliste">Docteur Généraliste</option>
    <option value="specialiste">Docteur Spécialiste</option>
    <option value="professeur">Professeur</option>
  </select>
</div>
```

## Important Changes

### Form Submission
Old:
```typescript
await createOrUpdateDoctor({
  name: form.name,
  consultationPrice: form.hasCustomPrice ? Number(form.consultationPrice) : undefined,
  academicRank: form.academicRank,
  // ...
});
```

New:
```typescript
await createOrUpdateDoctor({
  name: form.name,
  category: form.category,
  // Remove consultationPrice and academicRank
  // ...
});
```

### Loading Existing Doctor (Edit Mode)
Old:
```typescript
setForm({
  ...doctor,
  consultationPrice: doctor.consultationPrice ? String(doctor.consultationPrice) : "",
  hasCustomPrice: doctor.consultationPrice != null,
  academicRank: doctor.academicRank,
});
```

New:
```typescript
setForm({
  ...doctor,
  category: doctor.category ?? "specialiste",
});
```

## Steps

1. Open `src/components/dashboard/StaffDoctors.tsx`
2. Find the form state initialization (search for `hasCustomPrice` or `consultationPrice`)
3. Remove `consultationPrice`, `hasCustomPrice`, and `academicRank` from the form state
4. Add `category: "specialiste"` to the form state
5. Find the form JSX (where inputs are rendered)
6. Delete the price/rank related JSX sections
7. Add the category dropdown (exact code above)
8. Update the form submission handler to use `category`
9. Update the form population code for edit mode
10. Run: `bun tsc -b --noEmit` (should resolve some TypeScript errors)
11. Commit: `git add src/components/dashboard/StaffDoctors.tsx && git commit -m "feat: replace consultationPrice + academicRank with category field in doctor form"`

## Report

Write your report to: `.superpowers/sdd/task-6-report.md`

Include:
- Status: DONE
- Commit hash
- Test summary: "tsc: form state updated, reduced TypeScript errors"
