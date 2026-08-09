/**
 * Pure slot-availability rules shared by the Convex backend (catalog.ts) and
 * the unit tests: off-day ranges (congés), workday schedules, the clinic's
 * default opening hours and busy-slot overlap.
 *
 * No imports at all, so it can run in the Node test environment and be
 * bundled into the Convex server without pulling in frontend libraries.
 */

/** One day of a doctor's fiche schedule (JS getDay(): 0 = dimanche … 6 = samedi). */
export interface ScheduleEntry {
  day: number;
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

/** Local "yyyy-MM-dd" key from a Date (same shape as clinic.ts's `toDateKey`). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** JS getDay() of a "yyyy-MM-dd" key (0 = dimanche … 6 = samedi). */
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Whether `date` falls inside the inclusive [start, end] off-day range. */
export function isDateInRange(
  date: string,
  start: string,
  end: string,
): boolean {
  return date >= start && date <= end;
}

/** Workday schedule, in minutes since midnight (used when a doctor has no
    dedicated vacation hours set yet — e.g. before the staff fills the fiche). */
export const DEFAULT_MORNING_SLOTS = [
  9 * 60, 9 * 60 + 30, 10 * 60, 10 * 60 + 30, 11 * 60, 11 * 60 + 30, 12 * 60,
];
export const DEFAULT_AFTERNOON_SLOTS = [
  14 * 60, 14 * 60 + 30, 15 * 60, 15 * 60 + 30, 16 * 60, 16 * 60 + 30,
  17 * 60, 17 * 60 + 30,
];

/**
 * Clinic default slot starts when the doctor has no fiche yet: closed on
 * Sunday, mornings only on Saturday, mornings + afternoons on weekdays.
 */
export function defaultSlotsForDay(day: number): number[] {
  if (day === 0) return [];
  if (day === 6) return [...DEFAULT_MORNING_SLOTS];
  return [...DEFAULT_MORNING_SLOTS, ...DEFAULT_AFTERNOON_SLOTS];
}

/** 30-minute slot starts inside [start, end) of a schedule entry. */
export function slotsBetween(
  startMinutes: number,
  endMinutes: number,
): number[] {
  const slots: number[] = [];
  if (endMinutes <= startMinutes) return slots;
  for (let t = startMinutes; t < endMinutes; t += 30) slots.push(t);
  return slots;
}

/**
 * Slot starts (minutes since midnight) for a weekday, honoring the doctor's
 * fiche schedule; falls back to the clinic's default hours without a fiche.
 */
export function scheduleSlotsForDay(
  schedule: readonly ScheduleEntry[] | null | undefined,
  day: number,
): number[] {
  if (!schedule || schedule.length === 0) return defaultSlotsForDay(day);
  const slots: number[] = [];
  for (const entry of schedule.filter((e) => e.day === day)) {
    slots.push(
      ...slotsBetween(timeToMinutes(entry.start), timeToMinutes(entry.end)),
    );
  }
  return slots;
}

/** Whether a 30-minute slot starting at `start` overlaps a busy interval. */
export function isBusy(
  start: number,
  busy: readonly { start: number; end: number }[],
): boolean {
  const end = start + 30;
  return busy.some((b) => b.start < end && start < b.end);
}

/** Everything `computeAvailableSlots` needs from the DB, as pure inputs. */
export interface SlotRequest {
  /** Doctor is off that day (congés / indisponibilité) — no slot at all. */
  offDay: boolean;
  /** Doctor's fiche schedule, or null when no fiche exists yet. */
  schedule: readonly ScheduleEntry[] | null | undefined;
  /** Busy intervals in minutes (booked appointments of the day). */
  busy: readonly { start: number; end: number }[];
  /** "yyyy-MM-dd" key of the requested date. */
  date: string;
  /** Local "yyyy-MM-dd" key of today (to hide past slots). */
  todayKey: string;
  /** Current minutes since midnight, local time. */
  nowMinutes: number;
}

/**
 * Final list of available start times ("HH:mm") for a doctor + date.
 * - No slot when the doctor is off that day.
 * - No past slot when the date is today.
 * - A slot is unavailable when it overlaps a booked appointment.
 */
export function availableSlotTimes(req: SlotRequest): string[] {
  if (req.offDay) return [];
  const slots = scheduleSlotsForDay(req.schedule, weekdayOf(req.date));
  return slots
    .filter((start) => {
      if (req.date === req.todayKey && start <= req.nowMinutes) return false;
      return !isBusy(start, req.busy);
    })
    .map(minutesToTime);
}
