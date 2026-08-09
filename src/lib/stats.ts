/**
 * Pure aggregation of the staff dashboard statistics (« Statistiques »).
 * Extracted from the Convex query (convex/stats.ts) so the numbers — the
 * order of the day, revenue, statuses, per-doctor activity — are covered by
 * unit tests in src/lib/stats.test.ts.
 *
 * Only imports from ./slots (also dependency-free), so it bundles safely
 * into the Convex server.
 */
import { toDateKey } from "./slots";

export type StatsStatus = "pending" | "confirmed" | "completed" | "cancelled";

/** The appointment fields the aggregation needs. */
export interface StatsAppointmentRow {
  doctorId: string;
  date: string; // "yyyy-MM-dd"
  status: StatsStatus;
  amountPaid?: number;
  paidAt?: number;
}

/** The doctor fields the aggregation needs. */
export interface StatsDoctorRow {
  _id: string;
  name?: string;
  color?: string;
}

export interface DashboardStats {
  totals: {
    revenue30d: number;
    revenueToday: number;
    todayCount: number;
    active: number;
    total: number;
  };
  months: { key: string; label: string; total: number }[];
  days: { date: string; count: number }[];
  statusCounts: Record<StatsStatus, number>;
  byDoctor: { name: string; color: string; count: number; revenue: number }[];
}

const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** "yyyy-MM" key of a month. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** "mar", "avr"… short French month label from a "yyyy-MM" key. */
export function monthLabel(key: string): string {
  const [, m] = key.split("-").map(Number);
  return MONTH_NAMES[(m ?? 1) - 1].slice(0, 3);
}

/**
 * Aggregate the appointments of the clinic for the « Statistiques » view:
 * 6-month and 30-day buckets (oldest first, today last), KPI of the day,
 * statuses and per-doctor activity.
 */
export function computeDashboardStats(
  rows: readonly StatsAppointmentRow[],
  doctors: readonly StatsDoctorRow[],
  now: Date,
): DashboardStats {
  const doctorById = new Map(doctors.map((d) => [d._id, d]));

  const todayKey = toDateKey(now);

  // Last 6 calendar months, oldest first.
  const months: { key: string; label: string; total: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: monthLabel(monthKey(d)), total: 0 });
  }

  // Last 30 days, oldest first.
  const days: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({ date: toDateKey(d), count: 0 });
  }
  const dayIndex = new Map(days.map((d, i) => [d.date, i]));
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));

  const statusCounts: Record<StatsStatus, number> = {
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  };
  const byDoctor = new Map<
    string,
    { name: string; color: string; count: number; revenue: number }
  >();

  let revenue30d = 0;
  let revenueToday = 0;
  let todayCount = 0;
  let active = 0;

  for (const a of rows) {
    statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;

    const paid = a.amountPaid ?? 0;
    const paidDate = a.paidAt ? new Date(a.paidAt) : null;
    if (paidDate) {
      const mk = monthKey(paidDate);
      const mi = monthIndex.get(mk);
      if (mi != null) months[mi].total += paid;
      if (
        paidDate >=
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
      ) {
        revenue30d += paid;
      }
      if (toDateKey(paidDate) === todayKey) revenueToday += paid;
    }

    const di = dayIndex.get(a.date);
    if (di != null) days[di].count += 1;

    if (a.date === todayKey) todayCount += 1;
    if (a.status === "pending" || a.status === "confirmed") active += 1;

    const doctor = doctorById.get(a.doctorId);
    const key = a.doctorId;
    const entry = byDoctor.get(key) ?? {
      name: doctor?.name ?? "Praticien",
      color: doctor?.color ?? "teal",
      count: 0,
      revenue: 0,
    };
    entry.count += 1;
    entry.revenue += a.status === "cancelled" ? 0 : paid;
    byDoctor.set(key, entry);
  }

  const byDoctorList = [...byDoctor.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .map((d) => ({ ...d }));

  return {
    totals: {
      revenue30d,
      revenueToday,
      todayCount,
      active,
      total: rows.length,
    },
    months,
    days,
    statusCounts,
    byDoctor: byDoctorList,
  };
}
