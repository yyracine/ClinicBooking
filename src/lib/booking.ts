/**
 * Booking rules shared by the frontend and the Convex backend:
 * the 24-hour free-cancellation window and the FIFO waiting-list order.
 *
 * Pure functions, unit-tested in src/lib/booking.test.ts. The Convex
 * mutations in appointments.ts / waitingList.ts call these helpers so the
 * tests cover the logic that actually runs in production.
 */

/** Free-cancellation window for patients: up to 24 h before the appointment. */
export const CANCEL_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Lead time of the « J-1 » reminder e-mail: sent 24 h before the appointment. */
export const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000;

/** One day, in milliseconds. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reminder schedule for a confirmed appointment (rappel multiple) : the
 * patient is warned J-7, J-3 and J-1 before the consultation. Each lead is
 * expressed in days before the appointment.
 */
export const REMINDER_DAYS = [7, 3, 1] as const;

/**
 * When each reminder of an appointment starting at `date`/`time` should fire
 * (scheduler.runAt): exactly N days before (J-7, J-3, J-1). A lead is only
 * kept when its firing moment is still in the future (otherwise it is
 * already too late to warn the patient) and the date/time can be parsed.
 *
 * Returns the schedule, sorted from the farthest to the closest reminder:
 * `[{ daysBefore: 7, runAt: … }, { daysBefore: 3, runAt: … }, …]`.
 */
export function reminderScheduleTimes(
  date: string,
  time: string,
  now: number = Date.now(),
): { daysBefore: number; runAt: number }[] {
  const appointmentMs = Date.parse(`${date}T${time}`);
  if (!Number.isFinite(appointmentMs)) return [];

  const schedule: { daysBefore: number; runAt: number }[] = [];
  for (const daysBefore of REMINDER_DAYS) {
    const reminderMs = appointmentMs - daysBefore * DAY_MS;
    if (reminderMs > now) {
      schedule.push({ daysBefore, runAt: reminderMs });
    }
  }
  return schedule;
}

/**
 * Normalize a phone number to the international E.164 format required by
 * SMS providers (Twilio…). Accepts any of the usual local formats:
 *   "06 12 34 56 78"  -> "+2250612345678"  (leading 0, Côte d'Ivoire default)
 *   "+225 06 12 34 56 78" -> "+2250612345678"
 *   "00225 06 12 34 56 78" -> "+2250612345678"
 * Returns null when the number cannot be normalized (empty or no digits).
 */
export function toE164(phone: string, defaultCountryCode = "225"): string | null {
  let digits = phone.replace(/[^0-9+]/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) {
    digits = `+${digits.slice(2)}`;
  } else if (digits.startsWith("+")) {
    // keep as-is
  } else {
    // Local number (with or without the leading 0): prepend the default
    // country code. The leading 0 is kept (Côte d'Ivoire format).
    digits = `+${defaultCountryCode}${digits}`;
  }
  // Minimal sanity check: at least 8 digits after the country code.
  return /^\+\d{8,15}$/.test(digits) ? digits : null;
}

/**
 * Whether a patient may still cancel for free: the appointment must start at
 * least 24 h after `now`. The staff can always cancel (not covered here).
 *
 * Preserves the historical behaviour: when the date/time cannot be parsed,
 * the window cannot be proven to have closed, so cancellation stays allowed.
 */
export function canCancelFree(
  date: string,
  time: string,
  now: number = Date.now(),
): boolean {
  const start = Date.parse(`${date}T${time}`);
  if (!Number.isFinite(start)) return true;
  return start - now >= CANCEL_WINDOW_MS;
}

/**
 * FIFO ordering of waiting-list entries: the patient who asked first comes
 * first. Returns a new array; the input is never mutated.
 */
export function sortWaitingFifo<T extends { _creationTime: number }>(
  entries: readonly T[],
): T[] {
  return [...entries].sort((a, b) => a._creationTime - b._creationTime);
}

/** The waiting patient next in line (FIFO), or null when the list is empty. */
export function pickNextWaiting<T extends { _creationTime: number }>(
  entries: readonly T[],
): T | null {
  return sortWaitingFifo(entries)[0] ?? null;
}

/**
 * When the « J-1 » reminder of an appointment starting at `date`/`time`
 * should fire (scheduler.runAt): exactly 24 h before — provided that moment
 * is still in the future (otherwise it is already too late to warn the
 * patient) and the date/time can be parsed.
 */
export function reminderScheduleTime(
  date: string,
  time: string,
  now: number = Date.now(),
): number | null {
  const appointmentMs = Date.parse(`${date}T${time}`);
  if (!Number.isFinite(appointmentMs)) return null;
  const reminderMs = appointmentMs - REMINDER_LEAD_MS;
  return reminderMs > now ? reminderMs : null;
}

/**
 * Local "yyyy-MM-dd" key for today (same shape as `clinic.ts`'s `toDateKey`,
 * duplicated here so this module stays dependency-free for the Convex bundle).
 */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Whether a "yyyy-MM-dd" key is well-formed AND a real calendar date.
 * Rejects malformed strings ("08-08-2026", "2026/08/08", "2026-8-8") as
 * well as impossible dates ("2026-13-01", "2026-02-30").
 */
export function isValidDateKey(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(Date.parse(`${date}T00:00:00`));
  // Round-trip check: a rolled-over date (e.g. 02-30 → 03-02) must fail.
  return (
    d.getFullYear() === Number(date.slice(0, 4)) &&
    d.getMonth() + 1 === Number(date.slice(5, 7)) &&
    d.getDate() === Number(date.slice(8, 10))
  );
}

/**
 * Whether the date is strictly before "today" in the clinic's local
 * calendar. Today itself is still bookable (booking for the same day is
 * allowed). `today` defaults to the current local date.
 */
export function isPastDateKey(date: string, today: string = todayKey()): boolean {
  return date < today;
}

/**
 * Next free dossier number "D-0001" style: the highest existing number + 1.
 *
 * Only numbers below 9000 are taken into account: the demo patients reserve
 * the D-900x range (see demo.ts), so real record cards keep readable
 * D-000x numbers whatever the seeding order. Unlike a simple "count + 1",
 * this never reuses a number freed by a deletion.
 */
export function nextDossierNumber(existing: readonly string[]): string {
  let max = 0;
  for (const dossier of existing) {
    const m = /^D-(\d{4,})$/.exec(dossier);
    if (m) {
      const n = Number(m[1]);
      if (n < 9000 && n > max) max = n;
    }
  }
  return `D-${String(max + 1).padStart(4, "0")}`;
}

/**
 * Find the waiting-list entry of a patient for a doctor on a date, or null.
 *
 * No-duplicate rule: a patient may only be registered once per (doctor,
 * date). They may still wait for several doctors or several dates.
 */
export function findWaitingEntry<
  T extends { doctorId: string; date: string; userId: string },
>(
  entries: readonly T[],
  doctorId: string,
  date: string,
  userId: string,
): T | null {
  return (
    entries.find(
      (e) =>
        e.doctorId === doctorId && e.date === date && e.userId === userId,
    ) ?? null
  );
}
