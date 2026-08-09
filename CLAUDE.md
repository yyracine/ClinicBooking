# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Clinic Bookings — an online appointment booking platform for a medical clinic (French UI). Patients book appointments with practitioners; staff manage the schedule, payments, and medical records. See `ARCHITECTURE.md` (in French) for the full data model and flow diagrams — read it before making non-trivial backend changes.

## Commands

Package manager is **Bun**.

```bash
bun install              # install dependencies
bunx convex dev          # start local Convex deployment + codegen (run once, keep running during dev)
bun run dev              # start Vite dev server
bun run build            # tsc -b && vite build
bun run lint             # eslint .
bun run format           # prettier --write .
bun test                 # vitest run (backend logic tests only, see below)
bun test <path>          # run a single test file, e.g. bun test src/lib/pricing.test.ts
```

**After any change under `src/convex/`**, regenerate types before doing anything else:

```bash
bun convex dev --once
bun tsc -b --noEmit
```

Never hand-edit `src/convex/_generated/` — it's generated output.

Tests live next to the code they test (`src/**/*.test.ts`, see `vitest.config.ts`) and run in a Node environment — they cover pure business logic (`lib/pricing.ts`, `lib/clinic.ts`), not Convex functions or React components directly.

## Architecture

Frontend: Vite + React 19 + TypeScript, Tailwind CSS v4 + shadcn/ui (`src/components/ui/`). Backend: **Convex** (`src/convex/`) — queries (reactive reads), mutations (transactional writes), actions (external effects like email/SMS), and the scheduler (durable delayed execution). The frontend calls backend functions as typed local calls via `api.x.y`.

Key structure:
- `src/convex/schema.ts` — source of truth for the data model (tables: `users`, `services`, `doctors`, `appointments`, `patientProfiles`, `visits`, `medicalFiles`, `doctorOffDays`, `clinicSettings`, `notifications`, plus staff/activity-log tables).
- `src/convex/appointments.ts` — booking, cancellation, payment recording, status transitions.
- `src/convex/catalog.ts` — services, doctors, available-slot computation (accounts for doctor vacation days/hours and off-days).
- `src/convex/records.ts` — patient profiles, medical records, visit attachments.
- `src/convex/emails.ts` — transactional email/SMS actions (Elastic Email, Twilio) triggered via the scheduler.
- `src/convex/auth.ts` + `src/convex/auth/` — Convex Auth providers: email-code OTP, password, anonymous/guest, and a shared staff password.
- `src/lib/clinic.ts` / `src/lib/pricing.ts` — shared frontend helpers (French date/format helpers, insurance-based patient-share pricing).
- `src/components/dashboard/` — the bulk of the business UI (booking flow, staff planning/calendar/patients/doctors, stats, waiting list, notifications).
- `src/pages/` — top-level routes: landing, `/auth`, `/dashboard`, 404.

Appointment lifecycle: `pending` → (`recordPayment`) → `confirmed` → (`updateAppointmentStatus`) → `completed`, or `cancelled` at any point via `cancelAppointment`/`updateAppointmentStatus`.

Confirmation/reminders are multi-channel and scheduler-driven: `recordPayment` (or `recordMobilePayment`) patches the appointment, schedules an immediate confirmation and J-7/J-3/J-1 reminders via `ctx.scheduler.runAfter`/`runAt`. Each reminder re-checks the appointment status at send time (`getReminderInfo`) so a cancelled appointment doesn't fire a stale reminder. Email/SMS channels degrade gracefully to demo/log-only mode when `ELASTICEMAIL_API_KEY` / `TWILIO_*` env vars aren't set server-side.

Convex actions have no `ctx.db`; they read via `ctx.runQuery` (internal, session-less queries) and write via `ctx.runMutation`, with explicit return-type annotations to break the circular `api` type reference (see `seedDemo.ts` for the established pattern).

## Conventions

- All UI text and emails are in **French**.
- Currency is **FCFA**, always formatted with no decimals (`formatPrice` in `lib/clinic.ts`).
- Dates/times use local key strings `"yyyy-MM-dd"` / `"HH:mm"` (helpers in `lib/clinic.ts` and `catalog.ts`), not JS `Date` objects, for storage/comparison.
- Every sensitive query/mutation checks the caller's role server-side (`requireUser`, `requireStaff` via `getAuthUserId`) — don't rely on frontend gating alone.
- Demo/seed data (`seed.ts`, `demo.ts`, `seedDemo.ts`) is inserted idempotently on first load; safe to re-run.
