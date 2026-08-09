/**
 * CSV export helpers for the staff planning view (P19).
 *
 * The export targets Excel with French regional settings: every cell is
 * double-quoted, inner double quotes are doubled, fields are separated by
 * semicolons, and the payload starts with a UTF-8 BOM so Excel detects the
 * encoding on open.
 */

/** Fixed header line of the appointments export (order matters). */
export const APPOINTMENT_CSV_HEADERS = [
  "Date",
  "Heure",
  "Patient",
  "E-mail",
  "Service",
  "Praticien",
  "Statut",
  "Montant payé (FCFA)",
  "Notes",
] as const;

/** Quote a single CSV cell: wrap in double quotes, double any inner quote. */
export function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/** Serialize one row of cells into a semicolon-separated CSV line. */
export function csvRow(cells: readonly unknown[]): string {
  return cells.map(csvCell).join(";");
}

/** A single appointment row ready for the CSV export. */
export interface AppointmentCsvRow {
  date: string;
  time: string;
  patientName: string | null | undefined;
  patientEmail: string | null | undefined;
  serviceName: string | null | undefined;
  doctorName: string | null | undefined;
  statusLabel: string;
  amountPaid: number | null | undefined;
  notes: string | null | undefined;
}

/**
 * Build the complete CSV payload (BOM + header + one line per row) for the
 * appointments export. Field order matches {@link APPOINTMENT_CSV_HEADERS}.
 */
export function appointmentsToCsv(rows: AppointmentCsvRow[]): string {
  const lines: (readonly unknown[])[] = [
    APPOINTMENT_CSV_HEADERS,
    ...rows.map((a) => [
      a.date,
      a.time,
      a.patientName ?? "",
      a.patientEmail ?? "",
      a.serviceName ?? "",
      a.doctorName ?? "",
      a.statusLabel,
      a.amountPaid != null ? String(a.amountPaid) : "",
      a.notes ?? "",
    ]),
  ];
  return "\uFEFF" + lines.map(csvRow).join("\n");
}

/* ------------------------------------------------------------------ */
/* Planning filters (drives both the table and the CSV export)         */
/* ------------------------------------------------------------------ */

/** Filters of the staff planning, mirrored in the CSV export. */
export type PlanningFilter =
  | "all"
  | "today"
  | "pending"
  | "upcoming"
  | "completed"
  | "cancelled";

/** Minimal appointment shape used by the filter/search helpers. */
export interface FilterableAppointment {
  date: string;
  status: string;
  patient: { name?: string | null; email?: string | null };
  service?: { name?: string | null } | null;
  doctor?: { name?: string | null; title?: string | null } | null;
}

/**
 * Keep only the appointments matching the active planning filter.
 * Returns a new array; the input is never mutated.
 */
export function filterAppointments<T extends FilterableAppointment>(
  appointments: readonly T[],
  filter: PlanningFilter,
  todayKey: string,
): T[] {
  switch (filter) {
    case "today":
      return appointments.filter((a) => a.date === todayKey);
    case "pending":
      return appointments.filter(
        (a) => a.status === "pending" && a.date >= todayKey,
      );
    case "upcoming":
      return appointments.filter(
        (a) =>
          (a.status === "pending" || a.status === "confirmed") &&
          a.date >= todayKey,
      );
    case "completed":
      return appointments.filter((a) => a.status === "completed");
    case "cancelled":
      return appointments.filter((a) => a.status === "cancelled");
    default:
      return [...appointments];
  }
}

/**
 * Restrict to the appointments matching the free-text search (patient
 * name, e-mail, service, practitioner). A blank query keeps everything.
 */
export function searchAppointments<T extends FilterableAppointment>(
  appointments: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLocaleLowerCase("fr");
  if (!q) return [...appointments];
  return appointments.filter((a) =>
    [
      a.patient.name,
      a.patient.email,
      a.service?.name,
      a.doctor?.name,
      a.doctor?.title,
    ]
      .filter(Boolean)
      .some((v) => v!.toLocaleLowerCase("fr").includes(q)),
  );
}

/**
 * Order appointments chronologically: date first, then time. The combined
 * "yyyy-MM-ddTHH:mm" key compares correctly lexicographically. Appointments
 * sharing the same date AND time keep their original relative order
 * (explicitly stable via an index tie-breaker). Returns a new array; the
 * input is never mutated.
 */
export function sortAppointments<T extends { date: string; time: string }>(
  appointments: readonly T[],
): T[] {
  return [...appointments]
    .map((appointment, index) => ({ appointment, index }))
    .sort((a, b) => {
      const byKey = `${a.appointment.date}T${a.appointment.time}`.localeCompare(
        `${b.appointment.date}T${b.appointment.time}`,
      );
      return byKey !== 0 ? byKey : a.index - b.index;
    })
    .map(({ appointment }) => appointment);
}

/**
 * Group appointments by date key for the calendar view. Each day's list is
 * sorted by time ascending; appointments sharing the same time keep the
 * input order (explicitly stable via an index tie-breaker). Dates without
 * appointments get no map entry. Returns a new map; the input is never
 * mutated.
 */
export function groupAppointmentsByDate<
  T extends { date: string; time: string },
>(appointments: readonly T[]): Map<string, T[]> {
  const byDate = new Map<string, T[]>();
  for (const appointment of appointments) {
    const list = byDate.get(appointment.date) ?? [];
    list.push(appointment);
    byDate.set(appointment.date, list);
  }
  for (const list of byDate.values()) {
    const indexed = list.map((appointment, index) => ({ appointment, index }));
    indexed.sort((a, b) => {
      const byTime = a.appointment.time.localeCompare(b.appointment.time);
      return byTime !== 0 ? byTime : a.index - b.index;
    });
    indexed.forEach(({ appointment }, i) => {
      list[i] = appointment;
    });
  }
  return byDate;
}
