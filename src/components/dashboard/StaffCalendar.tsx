import { Button } from "@/components/ui/button";
import {
  STATUS_LABELS,
  formatShortDate,
  formatTimeRange,
  toDateKey,
  type AppointmentStatus,
  type StaffAppointment,
} from "@/lib/clinic";
import { groupAppointmentsByDate } from "@/lib/csv";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CalendarDays,
  CalendarOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useMemo, useState } from "react";

/** A declared off-day period of a doctor (from `listDoctorOffDays`). */
export interface OffDay {
  _id: string;
  doctorId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  doctor: { name: string; color: string } | null;
}

const DAY_MS = 86_400_000;

/** Monday-based start of the week. */
function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Number of days covered by an off period (inclusive). */
function periodDays(p: OffDay): number {
  return Math.round(
    (Date.parse(p.endDate) - Date.parse(p.startDate)) / DAY_MS,
  ) + 1;
}

const STATUS_CHIP: Record<AppointmentStatus, string> = {
  pending:
    "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  confirmed:
    "border-teal-500/35 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  completed: "border-border/60 bg-muted/50 text-muted-foreground",
  cancelled: "border-border/60 bg-muted/30 text-muted-foreground line-through",
};

function AppointmentChip({ a }: { a: StaffAppointment }) {
  const patientName = a.patient.name ?? "Patient";
  return (
    <div
      title={`${formatTimeRange(a.time, a.service?.durationMinutes ?? 30)} — ${patientName}${a.doctor ? ` (${a.doctor.name})` : ""} · ${STATUS_LABELS[a.status]}`}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium leading-tight",
        STATUS_CHIP[a.status],
      )}
    >
      <span className="shrink-0 font-semibold tabular-nums">
        {a.time.slice(0, 5)}
      </span>
      <span className="min-w-0 truncate">{patientName}</span>
    </div>
  );
}

export function StaffCalendar({
  appointments,
  offDays,
}: {
  appointments: StaffAppointment[];
  offDays: OffDay[];
}) {
  const [mode, setMode] = useState<"week" | "month">("week");
  const [weekAnchor, setWeekAnchor] = useState<Date>(() =>
    startOfWeek(new Date()),
  );
  const [monthAnchor, setMonthAnchor] = useState<Date>(() =>
    startOfMonth(new Date()),
  );

  const byDate = useMemo(
    () => groupAppointmentsByDate(appointments),
    [appointments],
  );

  /** Doctors off on a given date key. */
  const offByDate = useMemo(() => {
    const map = new Map<string, OffDay[]>();
    for (const p of offDays) {
      const count = periodDays(p);
      for (let i = 0; i < count; i++) {
        const key = toDateKey(
          new Date(Date.parse(p.startDate) + i * DAY_MS),
        );
        const list = map.get(key) ?? [];
        list.push(p);
        map.set(key, list);
      }
    }
    return map;
  }, [offDays]);

  const todayKey = toDateKey(new Date());

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)),
    [weekAnchor],
  );

  const monthCells = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(monthAnchor));
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [monthAnchor]);

  const weekLabel = `Semaine du ${formatShortDate(
    toDateKey(weekDays[0]),
  )} au ${formatShortDate(toDateKey(weekDays[6]))}`;
  const monthLabel = format(monthAnchor, "MMMM yyyy", { locale: fr });

  const goPrev = () => {
    if (mode === "week") setWeekAnchor((w) => addDays(w, -7));
    else setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  };
  const goNext = () => {
    if (mode === "week") setWeekAnchor((w) => addDays(w, 7));
    else setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  };
  const goToday = () => {
    setWeekAnchor(startOfWeek(new Date()));
    setMonthAnchor(startOfMonth(new Date()));
  };

  const goToWeekOf = (d: Date) => {
    setWeekAnchor(startOfWeek(d));
    setMode("week");
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: mode + navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-full border border-border/70 bg-card p-1 shadow-soft">
          {(["week", "month"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                mode === m
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <CalendarDays className="size-3.5" />
              {m === "week" ? "Semaine" : "Mois"}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <p className="hidden text-sm font-semibold text-foreground sm:block">
            {mode === "week" ? weekLabel : monthLabel}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-full"
              onClick={goPrev}
              title="Période précédente"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToday}
              className="rounded-full text-xs"
            >
              Aujourd'hui
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-full"
              onClick={goNext}
              title="Période suivante"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {mode === "week" ? (
        /* ------------------- Week view ------------------- */
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
          {weekDays.map((day) => {
            const key = toDateKey(day);
            const dayAppointments = byDate.get(key) ?? [];
            const off = offByDate.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={cn(
                  "flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft",
                  isToday ? "border-primary/40 ring-1 ring-primary/20" : "border-border/70",
                )}
              >
                <div
                  className={cn(
                    "border-b border-border/60 px-2.5 py-2 text-center",
                    isToday ? "bg-primary/10" : "bg-muted/40",
                  )}
                >
                  <p
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wide text-muted-foreground",
                    )}
                  >
                    {format(day, "EEEE", { locale: fr })}
                  </p>
                  <p
                    className={cn(
                      "mt-0.5 text-sm font-bold",
                      isToday ? "text-primary" : "text-foreground",
                    )}
                  >
                    {day.getDate()}
                  </p>
                </div>
                <div className="min-h-[120px] flex-1 space-y-1.5 p-2">
                  {off.length > 0 && (
                    <div className="space-y-1">
                      {off.map((p) => (
                        <div
                          key={p._id}
                          className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
                          title={p.reason || "Congé"}
                        >
                          <CalendarOff className="size-3 shrink-0" />
                          <span className="min-w-0 truncate">
                            Congé{p.doctor ? ` : ${p.doctor.name.replace("Dr ", "")}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {dayAppointments.length === 0 && off.length === 0 ? (
                    <p className="py-6 text-center text-[11px] text-muted-foreground/60">
                      —
                    </p>
                  ) : (
                    dayAppointments.map((a) => (
                      <AppointmentChip key={a._id} a={a} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ------------------- Month view ------------------- */
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
          <div className="grid grid-cols-7 border-b border-border/60 bg-muted/40">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
              <div
                key={d}
                className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((day) => {
              const key = toDateKey(day);
              const inMonth = day.getMonth() === monthAnchor.getMonth();
              const isToday = key === todayKey;
              const dayAppointments = byDate.get(key) ?? [];
              const off = offByDate.get(key) ?? [];
              const hidden = dayAppointments.length - 3;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => goToWeekOf(day)}
                  className={cn(
                    "flex min-h-[92px] flex-col gap-1 border-b border-r border-border/50 p-1.5 text-left transition-colors hover:bg-muted/40",
                    !inMonth && "bg-muted/20",
                  )}
                  title={inMonth ? "Voir la semaine" : ""}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/60",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {off.length > 0 && (
                      <span title={`Congé${off[0].doctor ? ` : ${off[0].doctor.name}` : ""}`}>
                        <CalendarOff className="size-3 shrink-0 text-amber-500" />
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayAppointments.slice(0, 3).map((a) => (
                      <AppointmentChip key={a._id} a={a} />
                    ))}
                    {hidden > 0 && (
                      <p className="px-1 text-[10px] font-semibold text-muted-foreground">
                        +{hidden} de plus
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-amber-500/40 bg-amber-500/20" />
          En attente
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-teal-500/40 bg-teal-500/20" />
          Confirmé
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-border bg-muted" />
          Terminé
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarOff className="size-3 text-amber-500" />
          Jour de congé
        </span>
        <span className="ml-auto hidden sm:inline">
          Cliquez sur un jour pour ouvrir sa semaine.
        </span>
      </div>
    </div>
  );
}
