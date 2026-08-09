import { describe, expect, it } from "vitest";
import {
  APPOINTMENT_CSV_HEADERS,
  appointmentsToCsv,
  csvCell,
  csvRow,
  filterAppointments,
  groupAppointmentsByDate,
  searchAppointments,
  sortAppointments,
  type FilterableAppointment,
  type PlanningFilter,
} from "./csv";

describe("csvCell", () => {
  it("wraps a plain value in double quotes", () => {
    expect(csvCell("abc")).toBe('"abc"');
  });

  it("doubles inner double quotes", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("renders numbers and booleans as strings", () => {
    expect(csvCell(30000)).toBe('"30000"');
    expect(csvCell(0)).toBe('"0"');
    expect(csvCell(false)).toBe('"false"');
  });

  it("renders null/undefined as an empty quoted cell", () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });
});

describe("csvRow", () => {
  it("joins cells with semicolons (Excel FR)", () => {
    expect(csvRow(["a", "b", "c"])).toBe('"a";"b";"c"');
  });

  it("escapes quotes inside cells", () => {
    expect(csvRow(['a"b', "c"])).toBe('"a""b";"c"');
  });
});

describe("appointmentsToCsv", () => {
  const fullRow = {
    date: "2026-08-08",
    time: "09:00",
    patientName: "Kouassi Aya",
    patientEmail: "aya@example.com",
    serviceName: "Consultation générale",
    doctorName: "Dr Kouassi",
    statusLabel: "Confirmé",
    amountPaid: 25000,
    notes: "Rien à signaler",
  };

  it("starts with the UTF-8 BOM so Excel detects the encoding", () => {
    expect(appointmentsToCsv([]).startsWith("\uFEFF")).toBe(true);
  });

  it("emits the fixed header as the first line", () => {
    const lines = appointmentsToCsv([]).split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("\uFEFF" + csvRow(APPOINTMENT_CSV_HEADERS));
  });

  it("formats a fully populated row in header order", () => {
    const lines = appointmentsToCsv([fullRow]).split("\n");
    expect(lines[1]).toBe(
      '"2026-08-08";"09:00";"Kouassi Aya";"aya@example.com";"Consultation générale";"Dr Kouassi";"Confirmé";"25000";"Rien à signaler"',
    );
  });

  it("renders missing fields as empty quoted cells", () => {
    const lines = appointmentsToCsv([
      {
        date: "2026-08-09",
        time: "10:30",
        patientName: null,
        patientEmail: undefined,
        serviceName: null,
        doctorName: undefined,
        statusLabel: "En attente",
        amountPaid: null,
        notes: undefined,
      },
    ]).split("\n");
    expect(lines[1]).toBe('"2026-08-09";"10:30";"";"";"";"";"En attente";"";""');
  });

  it("keeps a zero amount as a plain number (not an empty cell)", () => {
    const lines = appointmentsToCsv([{ ...fullRow, amountPaid: 0 }]).split(
      "\n",
    );
    expect(lines[1]).toContain(';"0";');
  });

  it("escapes double quotes in names and notes", () => {
    const lines = appointmentsToCsv([
      { ...fullRow, patientName: 'Aya "K"', notes: 'RDV "urgent"' },
    ]).split("\n");
    expect(lines[1]).toBe(
      '"2026-08-08";"09:00";"Aya ""K""";"aya@example.com";"Consultation générale";"Dr Kouassi";"Confirmé";"25000";"RDV ""urgent"""',
    );
  });

  it("joins several rows with newlines after the header", () => {
    const csv = appointmentsToCsv([
      { ...fullRow, time: "09:00" },
      { ...fullRow, time: "10:00" },
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3); // BOM header + 2 rows
    expect(lines[2]).toContain(';"10:00";');
  });
});

/* ------------------------------------------------------------------ */
/* Planning filters (table + CSV export)                               */
/* ------------------------------------------------------------------ */

const TODAY = "2026-08-08";

function apt(
  date: string,
  status: string,
  name = "Patient",
  time = "09:00",
): FilterableAppointment & { time: string } {
  return {
    date,
    time,
    status,
    patient: { name, email: `${name.toLowerCase()}@ex.com` },
    service: { name: "Consultation générale" },
    doctor: { name: "Dr Moreau", title: "Généraliste" },
  };
}

/** 8 appointments: 3 today, 3 upcoming, 2 past, mixed statuses. */
const FIXTURES = [
  apt(TODAY, "pending", "Aya", "09:00"),
  apt(TODAY, "confirmed", "Boris", "11:00"),
  apt(TODAY, "completed", "Claire", "14:00"),
  apt("2026-08-09", "pending", "David", "08:00"),
  apt("2026-08-09", "confirmed", "Eva", "10:00"),
  apt("2026-08-09", "cancelled", "Farid", "16:00"),
  apt("2026-08-07", "pending", "Gina", "08:00"),
  apt("2026-08-07", "completed", "Hugo", "13:00"),
];

/** Map a filterable appointment to a CSV row (same mapping as the view). */
function toCsvRow(a: FilterableAppointment & { time?: string }) {
  return {
    date: a.date,
    time: a.time ?? "09:00",
    patientName: a.patient.name ?? null,
    patientEmail: a.patient.email ?? null,
    serviceName: a.service?.name ?? null,
    doctorName: a.doctor?.name ?? null,
    statusLabel: a.status,
    amountPaid: null,
    notes: null,
  };
}

describe("filterAppointments (filtres du planning)", () => {
  it("keeps every appointment for “all”", () => {
    expect(filterAppointments(FIXTURES, "all", TODAY)).toHaveLength(8);
  });

  it("keeps only the appointments dated today for “today”", () => {
    expect(filterAppointments(FIXTURES, "today", TODAY)).toHaveLength(3);
  });

  it("keeps pending appointments from today onwards for “pending”", () => {
    const rows = filterAppointments(FIXTURES, "pending", TODAY);
    expect(rows).toHaveLength(2); // Aya (today) + David (future), not Gina (past)
    expect(rows.every((r) => r.status === "pending")).toBe(true);
    expect(rows.every((r) => r.date >= TODAY)).toBe(true);
  });

  it("keeps pending/confirmed from today onwards for “upcoming”", () => {
    const rows = filterAppointments(FIXTURES, "upcoming", TODAY);
    expect(rows).toHaveLength(4); // Aya, Boris, David, Eva
    expect(rows.some((r) => r.date < TODAY)).toBe(false);
    expect(rows.some((r) => r.status === "completed")).toBe(false);
  });

  it("keeps only completed appointments for “completed”", () => {
    expect(filterAppointments(FIXTURES, "completed", TODAY)).toHaveLength(2);
  });

  it("keeps only cancelled appointments for “cancelled”", () => {
    expect(filterAppointments(FIXTURES, "cancelled", TODAY)).toHaveLength(1);
  });

  it("does not mutate the input list", () => {
    const before = FIXTURES.length;
    filterAppointments(FIXTURES, "today", TODAY);
    expect(FIXTURES).toHaveLength(before);
  });
});

describe("searchAppointments (recherche libre)", () => {
  it("keeps everything when the query is empty or blank", () => {
    expect(searchAppointments(FIXTURES, "")).toHaveLength(8);
    expect(searchAppointments(FIXTURES, "   ")).toHaveLength(8);
  });

  it("matches the patient name case-insensitively", () => {
    const rows = searchAppointments(FIXTURES, "AYA");
    expect(rows).toHaveLength(1);
    expect(rows[0].patient.name).toBe("Aya");
  });

  it("matches on e-mail, service and practitioner fields", () => {
    expect(searchAppointments(FIXTURES, "aya@ex.com")).toHaveLength(1);
    expect(searchAppointments(FIXTURES, "générale")).toHaveLength(8);
    expect(searchAppointments(FIXTURES, "Moreau")).toHaveLength(8);
    expect(searchAppointments(FIXTURES, "généraliste")).toHaveLength(8);
  });

  it("returns nothing when nothing matches", () => {
    expect(searchAppointments(FIXTURES, "inconnu")).toHaveLength(0);
  });
});

describe("appointmentsToCsv — nombre de lignes exportées selon le filtre", () => {
  const cases: [PlanningFilter, number][] = [
    ["all", 8],
    ["today", 3],
    ["pending", 2],
    ["upcoming", 4],
    ["completed", 2],
    ["cancelled", 1],
  ];

  for (const [filter, expected] of cases) {
    it(`exports ${expected} data rows + header for “${filter}”`, () => {
      const rows = filterAppointments(FIXTURES, filter, TODAY);
      const lines = appointmentsToCsv(rows.map(toCsvRow)).split("\n");
      expect(rows).toHaveLength(expected);
      // BOM header line + exactly one line per exported appointment.
      expect(lines).toHaveLength(1 + expected);
    });
  }

  it("combines a filter with a search before exporting", () => {
    const rows = searchAppointments(
      filterAppointments(FIXTURES, "today", TODAY),
      "a",
    );
    const lines = appointmentsToCsv(rows.map(toCsvRow)).split("\n");
    expect(lines).toHaveLength(1 + rows.length);
    expect(lines.length).toBeGreaterThan(1);
  });
});

describe("sortAppointments (tri du tableau du planning)", () => {
  it("orders by date ascending", () => {
    const sorted = sortAppointments([
      { date: "2026-08-10", time: "09:00" },
      { date: "2026-08-08", time: "09:00" },
      { date: "2026-08-09", time: "09:00" },
    ]);
    expect(sorted.map((a) => a.date)).toEqual([
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
    ]);
  });

  it("orders by time ascending within the same date", () => {
    const sorted = sortAppointments([
      { date: "2026-08-08", time: "14:00" },
      { date: "2026-08-08", time: "09:30" },
      { date: "2026-08-08", time: "10:00" },
    ]);
    expect(sorted.map((a) => a.time)).toEqual(["09:30", "10:00", "14:00"]);
  });

  it("orders by date first, then time, from unsorted input", () => {
    const sorted = sortAppointments([
      { date: "2026-08-09", time: "08:00" },
      { date: "2026-08-08", time: "16:00" },
      { date: "2026-08-09", time: "07:00" },
      { date: "2026-08-08", time: "08:00" },
    ]);
    expect(sorted.map((a) => `${a.date} ${a.time}`)).toEqual([
      "2026-08-08 08:00",
      "2026-08-08 16:00",
      "2026-08-09 07:00",
      "2026-08-09 08:00",
    ]);
  });

  it("returns a new array and keeps the input untouched", () => {
    const items = [
      { date: "2026-08-09", time: "09:00" },
      { date: "2026-08-08", time: "09:00" },
    ];
    const sorted = sortAppointments(items);
    expect(sorted).not.toBe(items);
    expect(items.map((a) => a.date)).toEqual(["2026-08-09", "2026-08-08"]);
  });

  it("is stable: keeps the original order for identical date and time", () => {
    const items = [
      { date: "2026-08-08", time: "09:00", id: "B" },
      { date: "2026-08-08", time: "09:00", id: "A" },
      { date: "2026-08-08", time: "09:00", id: "C" },
    ];
    expect(sortAppointments(items).map((a) => a.id)).toEqual(["B", "A", "C"]);
  });

  it("is stable while still sorting the other keys around the ties", () => {
    const items = [
      { date: "2026-08-08", time: "09:00", id: "tie-2" },
      { date: "2026-08-08", time: "08:00", id: "earlier" },
      { date: "2026-08-08", time: "09:00", id: "tie-1" },
      { date: "2026-08-09", time: "09:00", id: "later" },
    ];
    expect(sortAppointments(items).map((a) => a.id)).toEqual([
      "earlier",
      "tie-2",
      "tie-1",
      "later",
    ]);
  });

  it("handles an empty list", () => {
    expect(sortAppointments([])).toEqual([]);
  });

  it("keeps the chronological order after the planning filter", () => {
    const sorted = sortAppointments(
      filterAppointments(FIXTURES, "upcoming", TODAY),
    );
    expect(sorted.map((a) => `${a.date}T${a.time}`)).toEqual([
      "2026-08-08T09:00", // Aya (today)
      "2026-08-08T11:00", // Boris (today)
      "2026-08-09T08:00", // David (tomorrow)
      "2026-08-09T10:00", // Eva (tomorrow)
    ]);
  });
});

describe("groupAppointmentsByDate (vue calendrier)", () => {
  it("groups appointments by date key", () => {
    const map = groupAppointmentsByDate([
      { date: "2026-08-08", time: "09:00", id: "a" },
      { date: "2026-08-09", time: "10:00", id: "b" },
      { date: "2026-08-08", time: "11:00", id: "c" },
    ]);
    expect([...map.keys()].sort()).toEqual(["2026-08-08", "2026-08-09"]);
    expect(map.get("2026-08-08")?.map((a) => a.id)).toEqual(["a", "c"]);
    expect(map.get("2026-08-09")?.map((a) => a.id)).toEqual(["b"]);
  });

  it("sorts each day's appointments by time ascending", () => {
    const map = groupAppointmentsByDate([
      { date: "2026-08-08", time: "14:00", id: "later" },
      { date: "2026-08-08", time: "09:00", id: "first" },
      { date: "2026-08-08", time: "11:30", id: "mid" },
    ]);
    expect(map.get("2026-08-08")?.map((a) => a.id)).toEqual([
      "first",
      "mid",
      "later",
    ]);
  });

  it("keeps the insertion order for identical times (stable)", () => {
    const map = groupAppointmentsByDate([
      { date: "2026-08-08", time: "09:00", id: "B" },
      { date: "2026-08-08", time: "09:00", id: "A" },
      { date: "2026-08-08", time: "09:00", id: "C" },
    ]);
    expect(map.get("2026-08-08")?.map((a) => a.id)).toEqual(["B", "A", "C"]);
  });

  it("returns no map entry for a date without appointments", () => {
    const map = groupAppointmentsByDate([
      { date: "2026-08-08", time: "09:00" },
    ]);
    expect(map.has("2026-08-09")).toBe(false);
    expect(map.get("2026-08-09")).toBeUndefined();
  });

  it("does not mutate the input list", () => {
    const items = [
      { date: "2026-08-09", time: "09:00" },
      { date: "2026-08-08", time: "09:00" },
    ];
    groupAppointmentsByDate(items);
    expect(items.map((a) => a.date)).toEqual(["2026-08-09", "2026-08-08"]);
  });

  it("handles an empty list", () => {
    expect(groupAppointmentsByDate([]).size).toBe(0);
  });
});
