import { describe, expect, it } from "vitest";
import {
  computeDashboardStats,
  monthKey,
  monthLabel,
  type StatsAppointmentRow,
  type StatsDoctorRow,
} from "./stats";

/** Samedi 8 août 2026, 10h30 (heure locale). */
const NOW = new Date(2026, 7, 8, 10, 30);
const at = (y: number, mo: number, d: number, h = 9, mi = 0) =>
  new Date(y, mo, d, h, mi).getTime();

const row = (partial: Partial<StatsAppointmentRow>): StatsAppointmentRow => ({
  doctorId: "doc1",
  date: "2026-08-08",
  status: "confirmed",
  ...partial,
});

const doctor = (id: string, name?: string): StatsDoctorRow => ({
  _id: id,
  name,
  color: "teal",
});

describe("computeDashboardStats — buckets chronologiques", () => {
  const stats = computeDashboardStats([], [], NOW);

  it("builds the last 6 calendar months, oldest first, ending on the current month", () => {
    expect(stats.months.map((m) => m.key)).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
    expect(stats.months.map((m) => m.label)).toEqual([
      "mar",
      "avr",
      "mai",
      "jui", // juin
      "jui", // juillet
      "aoû",
    ]);
  });

  it("builds the last 30 days, oldest first, ending on today", () => {
    expect(stats.days).toHaveLength(30);
    expect(stats.days[0].date).toBe("2026-07-10");
    expect(stats.days[29].date).toBe("2026-08-08");
    // Strictly increasing (ordre chronologique).
    for (let i = 1; i < stats.days.length; i += 1) {
      expect(stats.days[i].date > stats.days[i - 1].date).toBe(true);
    }
  });

  it("returns zeroed totals with no appointments", () => {
    expect(stats.totals).toEqual({
      revenue30d: 0,
      revenueToday: 0,
      todayCount: 0,
      active: 0,
      total: 0,
    });
    expect(stats.byDoctor).toEqual([]);
  });
});

describe("computeDashboardStats — ordre du jour", () => {
  it("counts today's appointments in the KPI and in the last day bucket", () => {
    const stats = computeDashboardStats(
      [row({ date: "2026-08-08" }), row({ date: "2026-08-08" })],
      [],
      NOW,
    );
    expect(stats.totals.todayCount).toBe(2);
    expect(stats.days[29].count).toBe(2);
  });

  it("keeps yesterday's appointments out of today's count but in their bucket", () => {
    const stats = computeDashboardStats(
      [row({ date: "2026-08-07" })],
      [],
      NOW,
    );
    expect(stats.totals.todayCount).toBe(0);
    expect(stats.days[28].date).toBe("2026-08-07");
    expect(stats.days[28].count).toBe(1);
    expect(stats.days[29].count).toBe(0);
  });

  it("places a recent appointment in the correct day bucket without counting it today", () => {
    // La fenêtre couvre les 30 derniers jours (10/07 → 08/08) :
    // le 1er août est dedans mais n'est pas aujourd'hui.
    const stats = computeDashboardStats(
      [row({ date: "2026-08-01" })],
      [],
      NOW,
    );
    expect(stats.totals.todayCount).toBe(0);
    expect(stats.days.find((d) => d.date === "2026-08-01")?.count).toBe(1);
    expect(stats.days[29].count).toBe(0);
  });
});

describe("computeDashboardStats — statuts", () => {
  it("counts every status and the active (pending + confirmed) appointments", () => {
    const stats = computeDashboardStats(
      [
        row({ status: "pending" }),
        row({ status: "pending" }),
        row({ status: "confirmed" }),
        row({ status: "completed" }),
        row({ status: "cancelled" }),
      ],
      [],
      NOW,
    );
    expect(stats.statusCounts).toEqual({
      pending: 2,
      confirmed: 1,
      completed: 1,
      cancelled: 1,
    });
    expect(stats.totals.active).toBe(3);
    expect(stats.totals.total).toBe(5);
  });
});

describe("computeDashboardStats — chiffre d'affaires", () => {
  it("credits revenue to the day, the 30-day window and the month of payment", () => {
    const stats = computeDashboardStats(
      [
        row({
          date: "2026-08-08",
          amountPaid: 5000,
          paidAt: at(2026, 7, 8, 9), // payé aujourd'hui
        }),
        row({
          date: "2026-07-29",
          amountPaid: 3000,
          paidAt: at(2026, 6, 29, 9), // il y a 10 jours
        }),
        row({
          date: "2026-06-29",
          amountPaid: 2000,
          paidAt: at(2026, 5, 29, 9), // il y a 40 jours
        }),
      ],
      [],
      NOW,
    );
    expect(stats.totals.revenueToday).toBe(5000);
    expect(stats.totals.revenue30d).toBe(8000); // 5000 + 3000
    expect(stats.months[5].total).toBe(5000); // août
    expect(stats.months[4].total).toBe(3000); // juillet
    expect(stats.months[3].total).toBe(2000); // juin
  });

  it("ignores an amountPaid without a payment date", () => {
    const stats = computeDashboardStats(
      [row({ amountPaid: 1000 })], // pas de paidAt
      [],
      NOW,
    );
    expect(stats.totals.revenueToday).toBe(0);
    expect(stats.totals.revenue30d).toBe(0);
    expect(stats.months.every((m) => m.total === 0)).toBe(true);
  });

  it("counts a cancelled payment in the revenue windows but not per doctor", () => {
    const stats = computeDashboardStats(
      [
        row({
          doctorId: "doc1",
          date: "2026-08-08",
          status: "cancelled",
          amountPaid: 2000,
          paidAt: at(2026, 7, 8, 9),
        }),
      ],
      [doctor("doc1", "Dr Un")],
      NOW,
    );
    expect(stats.totals.revenueToday).toBe(2000);
    expect(stats.byDoctor).toEqual([
      { name: "Dr Un", color: "teal", count: 1, revenue: 0 },
    ]);
  });
});

describe("computeDashboardStats — activité par praticien", () => {
  it("sums counts and revenue (excluding cancelled), sorted by revenue desc", () => {
    const stats = computeDashboardStats(
      [
        row({ doctorId: "doc1", amountPaid: 5000, paidAt: at(2026, 7, 8, 9) }),
        row({ doctorId: "doc1", amountPaid: 3000, paidAt: at(2026, 7, 8, 9) }),
        row({
          doctorId: "doc1",
          status: "cancelled",
          amountPaid: 2000,
          paidAt: at(2026, 7, 8, 9),
        }),
        row({ doctorId: "doc2", amountPaid: 10000, paidAt: at(2026, 7, 8, 9) }),
      ],
      [doctor("doc1", "Dr Un"), doctor("doc2", "Dr Deux")],
      NOW,
    );
    expect(stats.byDoctor).toEqual([
      { name: "Dr Deux", color: "teal", count: 1, revenue: 10000 },
      { name: "Dr Un", color: "teal", count: 3, revenue: 8000 },
    ]);
  });

  it("falls back to a placeholder when the doctor fiche is missing", () => {
    const stats = computeDashboardStats(
      [row({ doctorId: "inconnu", amountPaid: 5000, paidAt: at(2026, 7, 8, 9) })],
      [],
      NOW,
    );
    expect(stats.byDoctor).toEqual([
      { name: "Praticien", color: "teal", count: 1, revenue: 5000 },
    ]);
  });
});

describe("monthKey / monthLabel", () => {
  it("formats a month key and its short French label", () => {
    expect(monthKey(new Date(2026, 7, 1))).toBe("2026-08");
    expect(monthLabel("2026-08")).toBe("aoû");
    expect(monthLabel("2026-01")).toBe("jan");
  });
});
