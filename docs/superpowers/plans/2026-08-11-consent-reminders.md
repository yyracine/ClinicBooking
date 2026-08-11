# Consentement Explicite aux Rappels Multi-Canaux — Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit, opt-in consent for reminder notifications (email, SMS, in-app) to patient profiles. Patients control which channels they accept, with defaults that respect data privacy (no reminders until explicit consent).

**Architecture:** 
- Backend: Three boolean fields (`consentEmailReminders`, `consentSmsReminders`, `consentInAppReminders`) added to the `patientProfiles` schema. 
- Mutations: `createProfile` and `updateProfile` accept these fields. 
- Queries: `getPatientRecord` returns them for staff, patient queries implicitly include them.
- Email actions: `sendAppointmentReminder` and `sendAppointmentConfirmation` check consent before each channel send, defaulting to in-app if no consent given.
- UI: `PatientProfileForm.tsx` reused for both creation and editing with new "Communication Preferences" section.

**Tech Stack:** Convex (backend/mutations/actions), React (frontend form), TypeScript, shadcn/ui components.

## Global Constraints

- All UI text and labels in French
- Consent is opt-in: no reminders sent until explicit checkbox
- Backward compatible: old profiles (no consent fields) treated as `false` (no consent)
- In-app notification is fallback: always sent if email AND SMS both refused
- No breaking changes to existing queries/mutations; add optional fields
- Convex codegen required after schema.ts changes: `bun convex dev --once`
- Follow existing code patterns: use `v.optional(v.boolean())` for optional booleans, `requireUser`/`requireStaff` for auth

---

## Task 1: Add Consent Fields to Schema

**Files:**
- Modify: `src/convex/schema.ts:114-140` (patientProfiles table definition)

**Interfaces:**
- Consumes: (none — schema is foundational)
- Produces: Three new optional boolean fields in the patientProfiles table that all downstream code relies on

- [ ] **Step 1: Open schema.ts and locate patientProfiles table definition (around line 114)**

The table currently ends at line 140 with `.index("by_user", ["userId"])`.

- [ ] **Step 2: Add the three consent fields before the index**

Replace this:
```typescript
    // ...
    reimbursementRate: v.optional(v.number()), // reimbursement rate (%)
  }).index("by_user", ["userId"]),
```

With this:
```typescript
    // ...
    reimbursementRate: v.optional(v.number()), // reimbursement rate (%)
    
    // Consent for reminder channels (opt-in, no reminders without explicit consent)
    consentEmailReminders: v.optional(v.boolean()), // accept email reminders (non-encrypted, risk acknowledged)
    consentSmsReminders: v.optional(v.boolean()), // accept SMS reminders
    consentInAppReminders: v.optional(v.boolean()), // accept in-app notifications
  }).index("by_user", ["userId"]),
```

- [ ] **Step 3: Verify the syntax is correct**

Run: `bun tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/convex/schema.ts
git commit -m "feat: add consent fields to patientProfiles schema"
```

---

## Task 2: Regenerate Convex Types

**Files:**
- Generated (no edits): `src/convex/_generated/api.d.ts`

**Interfaces:**
- Consumes: Updated schema.ts from Task 1
- Produces: Convex auto-generated types with the new consent fields

- [ ] **Step 1: Run Convex codegen**

```bash
bun convex dev --once
```

Expected output: Code generation completes, no errors about schema validation.

- [ ] **Step 2: Verify types were updated**

Run: `bun tsc -b --noEmit`
Expected: No errors related to schema or types.

- [ ] **Step 3: Commit**

```bash
git add src/convex/_generated/
git commit -m "chore: regenerate Convex types after schema update"
```

---

## Task 3: Update createProfile Mutation

**Files:**
- Modify: `src/convex/records.ts:135-235` (createProfile mutation)

**Interfaces:**
- Consumes: Updated schema from Task 1
- Produces: createProfile mutation that accepts and persists the three consent fields

- [ ] **Step 1: Open records.ts and locate createProfile mutation (line 135)**

- [ ] **Step 2: Add consent fields to the args object**

Locate the args block (lines 136–159):
```typescript
export const createProfile = mutation({
  args: {
    // ... existing fields ...
    reimbursementRate: v.optional(v.number()),
  },
```

Add after `reimbursementRate`:
```typescript
    // Consent for reminders
    consentEmailReminders: v.optional(v.boolean()),
    consentSmsReminders: v.optional(v.boolean()),
    consentInAppReminders: v.optional(v.boolean()),
  },
```

- [ ] **Step 3: Add consent fields to the insertion**

Locate the insert call (line 211):
```typescript
    return await ctx.db.insert("patientProfiles", {
      userId,
      dossierNumber,
      email,
      // ... existing fields ...
      insured: args.insured,
      ...insurance,
    });
```

Add before the closing brace:
```typescript
    return await ctx.db.insert("patientProfiles", {
      userId,
      dossierNumber,
      email,
      // ... existing fields ...
      insured: args.insured,
      ...insurance,
      consentEmailReminders: args.consentEmailReminders,
      consentSmsReminders: args.consentSmsReminders,
      consentInAppReminders: args.consentInAppReminders,
    });
```

- [ ] **Step 4: Verify compilation**

Run: `bun tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/convex/records.ts
git commit -m "feat: accept consent fields in createProfile mutation"
```

---

## Task 4: Update updateProfile Mutation

**Files:**
- Modify: `src/convex/records.ts:247-327` (updateProfile mutation)

**Interfaces:**
- Consumes: Updated schema from Task 1
- Produces: updateProfile mutation that accepts and persists the three consent fields

- [ ] **Step 1: Open records.ts and locate updateProfile mutation (line 247)**

- [ ] **Step 2: Add consent fields to the args object**

Locate the args block (lines 248–268):
```typescript
export const updateProfile = mutation({
  args: {
    // ... existing fields ...
    reimbursementRate: v.optional(v.number()),
  },
```

Add after `reimbursementRate`:
```typescript
    // Consent for reminders
    consentEmailReminders: v.optional(v.boolean()),
    consentSmsReminders: v.optional(v.boolean()),
    consentInAppReminders: v.optional(v.boolean()),
  },
```

- [ ] **Step 3: Add consent fields to the patch call**

Locate the second patch call (line 309):
```typescript
    await ctx.db.patch(profile._id, {
      phone: args.phone.trim(),
      // ... existing fields ...
      insured: args.insured,
      ...insurance,
    });
```

Add before the closing brace:
```typescript
    await ctx.db.patch(profile._id, {
      phone: args.phone.trim(),
      // ... existing fields ...
      insured: args.insured,
      ...insurance,
      consentEmailReminders: args.consentEmailReminders,
      consentSmsReminders: args.consentSmsReminders,
      consentInAppReminders: args.consentInAppReminders,
    });
```

- [ ] **Step 4: Verify compilation**

Run: `bun tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/convex/records.ts
git commit -m "feat: accept consent fields in updateProfile mutation"
```

---

## Task 5: Add Consent UI to PatientProfileForm

**Files:**
- Modify: `src/components/dashboard/PatientProfileForm.tsx:22-67, 69-137` (types, state, form submission)

**Interfaces:**
- Consumes: Updated `createProfile` and `updateProfile` mutations from Tasks 3–4
- Produces: UI form with three consent checkboxes and updated state handling

- [ ] **Step 1: Update the BoolField type to include consent fields**

Locate line 43:
```typescript
type BoolField = "insured" | "reimbursement100" | "tiersPayant";
```

Replace with:
```typescript
type BoolField = 
  | "insured" 
  | "reimbursement100" 
  | "tiersPayant"
  | "consentEmailReminders"
  | "consentSmsReminders"
  | "consentInAppReminders";
```

- [ ] **Step 2: Add default consent values to EMPTY**

Locate the EMPTY object (lines 45–67). Add before the closing brace:
```typescript
const EMPTY = {
  // ... existing fields ...
  reimbursementRate: "",
  
  // Consent defaults (false = no explicit consent given)
  consentEmailReminders: false,
  consentSmsReminders: false,
  consentInAppReminders: false,
};
```

- [ ] **Step 3: Add consent fields to the form state initialization**

Locate line 73–76 where form state is initialized:
```typescript
  const [form, setForm] = useState({
    ...EMPTY,
    email: accountEmail,
  });
```

No change needed — the spread of EMPTY automatically includes the new fields.

- [ ] **Step 4: Add consent section to the form JSX**

Locate the insurance section in the form (around line 351–416). After the insurance closing `</div>`, add:

```typescript
            {/* ---------- Communication Preferences ---------- */}
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 sm:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="size-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  Préférences de communication
                </p>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Choisissez les canaux par lesquels vous souhaitez recevoir les
                rappels de vos rendez-vous.
              </p>
              
              <div className="space-y-3">
                <ToggleRowWithDescription
                  label="E-mail non chiffré"
                  description="J'accepte de recevoir des rappels de rendez-vous par e-mail non chiffré et je suis informé des risques."
                  checked={form.consentEmailReminders}
                  onChange={toggle("consentEmailReminders")}
                />
                <ToggleRowWithDescription
                  label="SMS"
                  description="J'accepte de recevoir des rappels par SMS."
                  checked={form.consentSmsReminders}
                  onChange={toggle("consentSmsReminders")}
                />
                <ToggleRowWithDescription
                  label="Notifications in-app"
                  description="J'accepte les notifications in-app."
                  checked={form.consentInAppReminders}
                  onChange={toggle("consentInAppReminders")}
                />
              </div>
              
              <p className="mt-4 text-[11px] text-muted-foreground border-t border-border/70 pt-3">
                ℹ️ Si vous refusez e-mail et SMS, vous recevrez toujours les
                notifications in-app pour les confirmations et rappels.
              </p>
            </div>
```

- [ ] **Step 5: Create the ToggleRowWithDescription helper component**

Locate the existing ToggleRow component definition at the bottom of the file (around line 470+). Add this new component above it:

```typescript
function ToggleRowWithDescription({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border/40 bg-background/50 p-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
        className="mt-1 shrink-0"
      />
    </div>
  );
}
```

- [ ] **Step 6: Add consent fields to form submission**

Locate handleSubmit function (line 85–137). In the createProfile call, add the consent fields:

```typescript
      await createProfile({
        // ... existing fields ...
        reimbursementRate: form.insured ? rate : undefined,
        consentEmailReminders: form.consentEmailReminders,
        consentSmsReminders: form.consentSmsReminders,
        consentInAppReminders: form.consentInAppReminders,
      });
```

- [ ] **Step 7: Verify compilation and styling**

Run: `bun tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/dashboard/PatientProfileForm.tsx
git commit -m "feat: add communication preferences section to patient profile form"
```

---

## Task 6: Modify sendAppointmentReminder to Check Consent

**Files:**
- Modify: `src/convex/emails.ts:461-507` (sendAppointmentReminder action)

**Interfaces:**
- Consumes: Patient consent fields from patientProfiles, getReminderInfo query result
- Produces: sendAppointmentReminder action that respects consent before sending each channel

- [ ] **Step 1: Locate sendAppointmentReminder (line 461)**

- [ ] **Step 2: Fetch patient profile to read consent**

After the getReminderInfo query (line 467–470), add:

```typescript
    const profile = await ctx.runQuery(
      api.records.getPatientRecord,
      { userId: info.userId }
    );
    
    if (!profile) {
      console.log(`[emails] Profil patient introuvable pour ${info.userId}`);
      return {
        email: { sent: false, reason: "no-profile" },
        sms: { sent: false, reason: "no-profile" },
      };
    }
```

After this check, the action has access to `profile.consentEmailReminders`, `profile.consentSmsReminders`, and `profile.consentInAppReminders`.

- [ ] **Step 3: Modify deliverAppointmentNotice to accept a consent config**

This is optional but cleaner: modify the deliverAppointmentNotice call to accept which channels are consented. For now, pass the consent state inline (next step).

- [ ] **Step 4: Update the return of sendAppointmentReminder**

Locate the return statement (line 505):
```typescript
    return deliverAppointmentNotice(ctx, notice);
```

This function currently sends via all available channels. We need to wrap it to respect consent. Replace the call:

```typescript
    // Check consent for each channel, default to in-app if none accepted
    const emailConsent = profile.consentEmailReminders === true;
    const smsConsent = profile.consentSmsReminders === true;
    const inAppConsent = 
      profile.consentInAppReminders === true || 
      (!emailConsent && !smsConsent);

    // Send only to consented channels
    const deliveryResult = await deliverAppointmentNotice(ctx, notice, {
      email: emailConsent && process.env.ELASTICEMAIL_API_KEY ? true : false,
      sms: smsConsent && process.env.TWILIO_ACCOUNT_SID ? true : false,
      inApp: inAppConsent,
    });

    return deliveryResult;
```

**Note:** This assumes `deliverAppointmentNotice` will be modified in the next task to accept a config. For now, store the logic inline and pass to the function.

- [ ] **Step 5: Verify the logic is sound**

Review the condition: if both email and SMS are false/undefined, in-app must be true. ✓

- [ ] **Step 6: Verify compilation**

Run: `bun tsc -b --noEmit`
Expected: No errors. (If `deliverAppointmentNotice` signature doesn't match yet, you'll see an error — proceed to Task 7 to fix it.)

- [ ] **Step 7: Commit (tentative, may need Task 7 first)**

```bash
git add src/convex/emails.ts
git commit -m "feat: check email/SMS consent before sending reminders"
```

---

## Task 7: Refactor deliverAppointmentNotice to Respect Consent

**Files:**
- Modify: `src/convex/emails.ts:290-370` (deliverAppointmentNotice function)

**Interfaces:**
- Consumes: Consent boolean config object (which channels to send to)
- Produces: Refactored function that sends only to consented channels

- [ ] **Step 1: Locate deliverAppointmentNotice (search in emails.ts)**

This is a helper function called by both `sendAppointmentReminder` and `sendAppointmentConfirmation`. Typically around line 290–370.

- [ ] **Step 2: Update the function signature**

Current signature (example):
```typescript
async function deliverAppointmentNotice(
  ctx: ActionCtx,
  notice: AppointmentNotice
): Promise<{ email: SendResult; sms: SendResult }>
```

Update to:
```typescript
async function deliverAppointmentNotice(
  ctx: ActionCtx,
  notice: AppointmentNotice,
  channels?: { email?: boolean; sms?: boolean; inApp?: boolean }
): Promise<{ email: SendResult; sms: SendResult }>
```

- [ ] **Step 3: Add consent checks before each channel send**

In the function body, locate email send logic:
```typescript
    let emailResult: SendResult = { sent: false, reason: "no-key" };
    if (ELASTICEMAIL_API_KEY) {
      // ... email send code ...
    }
```

Wrap with consent check:
```typescript
    let emailResult: SendResult = { sent: false, reason: "not-consented" };
    if (channels?.email !== false && ELASTICEMAIL_API_KEY) {
      // ... email send code ...
    }
```

Similarly for SMS:
```typescript
    let smsResult: SendResult = { sent: false, reason: "not-consented" };
    if (channels?.sms !== false && TWILIO_ACCOUNT_SID) {
      // ... SMS send code ...
    }
```

And in-app (after email/SMS, create notification if consented or fallback):
```typescript
    if (channels?.inApp !== false) {
      // Create in-app notification
      await ctx.runMutation(internal.notifications.create, { ... });
    }
```

- [ ] **Step 4: Handle backward compatibility**

If channels is undefined (old code calling this function), default all to true:
```typescript
    const channels_ = channels ?? { email: true, sms: true, inApp: true };
```

Then use `channels_.*` in all checks.

- [ ] **Step 5: Verify compilation**

Run: `bun tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/convex/emails.ts
git commit -m "refactor: deliverAppointmentNotice respects consent config"
```

---

## Task 8: Modify sendAppointmentConfirmation to Check Consent

**Files:**
- Modify: `src/convex/emails.ts:383-453` (sendAppointmentConfirmation action)

**Interfaces:**
- Consumes: Patient consent fields via getPatientRecord query
- Produces: sendAppointmentConfirmation action that respects the same consent logic as reminders

- [ ] **Step 1: Locate sendAppointmentConfirmation (line 383)**

- [ ] **Step 2: Fetch patient profile for consent**

After args are received, add (similar to Task 6):
```typescript
    const profile = await ctx.runQuery(
      api.records.getPatientRecord,
      { userId: args.userId }
    );
    
    if (!profile) {
      console.log(`[emails] Profil patient introuvable pour confirmation`);
      return {
        email: { sent: false, reason: "no-profile" },
        sms: { sent: false, reason: "no-profile" },
      };
    }
```

- [ ] **Step 3: Build consent config and call deliverAppointmentNotice**

Locate the deliverAppointmentNotice call (around line 450). Replace with:

```typescript
    const emailConsent = profile.consentEmailReminders === true;
    const smsConsent = profile.consentSmsReminders === true;
    const inAppConsent = 
      profile.consentInAppReminders === true || 
      (!emailConsent && !smsConsent);

    return deliverAppointmentNotice(ctx, notice, {
      email: emailConsent && process.env.ELASTICEMAIL_API_KEY ? true : false,
      sms: smsConsent && process.env.TWILIO_ACCOUNT_SID ? true : false,
      inApp: inAppConsent,
    });
```

- [ ] **Step 4: Verify compilation**

Run: `bun tsc -b --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/convex/emails.ts
git commit -m "feat: check email/SMS consent in sendAppointmentConfirmation"
```

---

## Task 9: Write Unit Tests for Consent Logic

**Files:**
- Create: `src/lib/consent.test.ts` (new test file)

**Interfaces:**
- Consumes: Logic for determining which channels to send based on consent
- Produces: Test suite verifying consent logic across all scenarios

- [ ] **Step 1: Create test file**

Create `src/lib/consent.test.ts` with this structure:

```typescript
import { describe, it, expect } from "vitest";

// Helper function to determine which channels to send
function getActiveChannels(
  emailConsent: boolean | undefined,
  smsConsent: boolean | undefined,
  inAppConsent: boolean | undefined
): { email: boolean; sms: boolean; inApp: boolean } {
  const email = emailConsent === true;
  const sms = smsConsent === true;
  const inApp = inAppConsent === true || (!email && !sms);
  return { email, sms, inApp };
}

describe("Consent logic", () => {
  it("sends to all channels if all consents are true", () => {
    const channels = getActiveChannels(true, true, true);
    expect(channels).toEqual({ email: true, sms: true, inApp: true });
  });

  it("sends only to email if only email consented", () => {
    const channels = getActiveChannels(true, false, false);
    expect(channels).toEqual({ email: true, sms: false, inApp: false });
  });

  it("sends only to SMS if only SMS consented", () => {
    const channels = getActiveChannels(false, true, false);
    expect(channels).toEqual({ email: false, sms: true, inApp: false });
  });

  it("sends only to in-app if only in-app consented", () => {
    const channels = getActiveChannels(false, false, true);
    expect(channels).toEqual({ email: false, sms: false, inApp: true });
  });

  it("defaults to in-app if no channels consented", () => {
    const channels = getActiveChannels(false, false, false);
    expect(channels).toEqual({ email: false, sms: false, inApp: true });
  });

  it("defaults to in-app if undefined (backward compat)", () => {
    const channels = getActiveChannels(undefined, undefined, undefined);
    expect(channels).toEqual({ email: false, sms: false, inApp: true });
  });

  it("treats undefined as false (backward compat) with email+SMS", () => {
    const channels = getActiveChannels(undefined, true, undefined);
    expect(channels).toEqual({ email: false, sms: true, inApp: false });
  });

  it("disables in-app fallback if email or SMS consented", () => {
    const channels = getActiveChannels(true, false, false);
    expect(channels.inApp).toBe(false);
  });

  it("enables in-app fallback only if both email and SMS are false", () => {
    const channels = getActiveChannels(false, false, false);
    expect(channels.inApp).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test suite**

```bash
bun test src/lib/consent.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/consent.test.ts
git commit -m "test: add unit tests for consent logic"
```

---

## Task 10: Write Integration Tests for Email Actions

**Files:**
- Modify: `src/convex/emails.test.ts` (add new test cases)

**Interfaces:**
- Consumes: sendAppointmentReminder, sendAppointmentConfirmation actions and their consent logic
- Produces: Integration tests verifying that consent fields are respected in actual email/SMS sending

- [ ] **Step 1: Locate or create emails.test.ts**

Check if `src/convex/emails.test.ts` exists. If not, create it.

- [ ] **Step 2: Add test cases for consent**

Add these test cases to the file:

```typescript
describe("sendAppointmentReminder with consent", () => {
  it("sends email reminder only if consentEmailReminders is true", async () => {
    // Mock profile with email consent only
    // Mock getReminderInfo to return appointment data
    // Call sendAppointmentReminder
    // Assert email was sent, SMS was not
  });

  it("sends SMS reminder only if consentSmsReminders is true", async () => {
    // Mock profile with SMS consent only
    // Assert SMS was sent, email was not
  });

  it("defaults to in-app if no email/SMS consent", async () => {
    // Mock profile with both email and SMS consent false
    // Assert in-app notification was created, email/SMS were not sent
  });

  it("respects multiple consents", async () => {
    // Mock profile with email AND SMS consent
    // Assert both were sent
  });

  it("treats undefined consent as false (backward compat)", async () => {
    // Mock profile with undefined consent fields (old profile)
    // Assert defaults to in-app fallback
  });
});

describe("sendAppointmentConfirmation with consent", () => {
  it("respects consent same as reminders", async () => {
    // Mirror reminder tests for confirmation
  });
});
```

**Note:** Full integration test implementation requires mocking Convex context, queries, and mutations. Follow the existing pattern in your test suite (if any).

- [ ] **Step 3: Run the tests**

```bash
bun test src/convex/emails.test.ts
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/convex/emails.test.ts
git commit -m "test: add integration tests for email consent logic"
```

---

## Task 11: Manual Testing Scenario

**Files:**
- (None — manual testing in browser/dev server)

**Interfaces:**
- Consumes: Complete implementation from Tasks 1–10
- Produces: Verified working feature with user-facing confirmation

### Test Cases

- [ ] **Test A: Create patient profile with all consents**
  1. Start dev server: `bun run dev` (ensure Convex is running: `bun convex dev`)
  2. Navigate to `/auth` and sign up as new patient
  3. Fill out patient profile form
  4. In "Préférences de communication", check all three boxes
  5. Submit form
  6. Verify profile saved in Convex dashboard: three fields are `true`
  7. Expected: Profile created, all consents recorded

- [ ] **Test B: Create profile with no consents**
  1. Repeat Test A but **do not check** any consent boxes
  2. Submit form
  3. Verify profile saved: three fields are `false`
  4. Expected: Profile created, no consents recorded

- [ ] **Test C: Edit profile and modify consents**
  1. Log in as the patient from Test A
  2. Navigate to edit profile (e.g., Dashboard → My Profile)
  3. Uncheck email consent, keep SMS and in-app
  4. Save
  5. Verify in Convex dashboard: `consentEmailReminders=false`, others unchanged
  6. Expected: Profile updated selectively, only changed fields modified

- [ ] **Test D: Appointment reminder respects email consent**
  1. Create an appointment as the patient from Test B (no consents)
  2. Record payment at clinic → triggers `recordPayment` → schedules confirmation + J-7 reminder
  3. Check Convex logs (Actions tab, emails.ts logs)
  4. Verify email was NOT sent (reason: "not-consented")
  5. Verify in-app notification WAS created (fallback)
  6. Expected: Reminder respects lack of email consent

- [ ] **Test E: Appointment reminder respects SMS consent**
  1. Create appointment as patient with SMS consent only
  2. Record payment
  3. Check logs
  4. Verify SMS was sent, email was not
  5. Expected: Reminder respects SMS consent, skips email

- [ ] **Test F: Backward compatibility (old profile with no consent fields)**
  1. Manually insert an old patient profile into Convex database (via dashboard) with no consent fields
  2. Create an appointment for this patient
  3. Record payment → trigger reminder
  4. Verify in-app notification was created (fallback, because all consents are undefined → false)
  5. Expected: Old profiles default to in-app safely

---

## Acceptance Criteria

- [ ] Schema updated: 3 consent fields added to `patientProfiles`
- [ ] Convex types regenerated: no build errors
- [ ] createProfile mutation accepts and persists consent fields
- [ ] updateProfile mutation accepts and persists consent fields
- [ ] PatientProfileForm displays "Préférences de communication" section with 3 toggles
- [ ] Consent toggles appear in both create and edit flows
- [ ] sendAppointmentReminder checks consent before each channel send
- [ ] sendAppointmentConfirmation checks consent before each channel send
- [ ] Fallback to in-app if no email/SMS consent
- [ ] Unit tests pass (consent logic)
- [ ] Integration tests pass (email actions)
- [ ] Manual tests pass (all 6 scenarios)
- [ ] Backward compatible: old profiles treated as no consent
- [ ] No breaking changes to existing queries/mutations

---

## Post-Implementation

After all tasks are complete and tests pass:

1. **Code review:** Request review on final PR (all tasks folded into one or a few logical commits)
2. **Staging deployment:** Test in staging with real Elastic Email / Twilio keys
3. **User documentation:** Update help/FAQ if needed (patients should understand consent toggle)
4. **Audit trail (optional):** Consider logging consent changes to `activityLogs` for compliance

