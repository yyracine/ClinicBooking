import { AppointmentCard } from "@/components/dashboard/AppointmentCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import {
  appointmentPrice,
  formatPrice,
  formatShortDate,
  toDateKey,
  type AppointmentWithDetails,
} from "@/lib/clinic";
import { downloadAppointmentReceipt } from "@/lib/receipt";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { BellRing, CalendarPlus, CalendarX2, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const FILTERS = [
  { key: "upcoming", label: "À venir" },
  { key: "past", label: "Passés" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export function MyAppointments({ onBook }: { onBook: () => void }) {
  const items = useQuery(api.appointments.myAppointments);
  const cancelAppointment = useMutation(api.appointments.cancelAppointment);
  const waiting = useQuery(api.waitingList.myWaitingList);
  const leaveWaitingList = useMutation(api.waitingList.leaveWaitingList);
  const profile = useQuery(api.records.myProfile);
  const grid = useQuery(api.settings.pricingGrid);
  const [filter, setFilter] = useState<FilterKey>("upcoming");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);

  const handleReceipt = (a: AppointmentWithDetails) => {
    if (a.amountPaid == null) return;
    const price = appointmentPrice(a, grid);
    downloadAppointmentReceipt({
      patientName: profile
        ? `${profile.firstName} ${profile.lastName}`
        : "Patient",
      dossierNumber: profile?.dossierNumber,
      patientEmail: profile?.email,
      serviceName: a.service?.name ?? "",
      doctorName: a.doctor?.name ?? "",
      doctorTitle: a.doctor?.title,
      date: a.date,
      time: a.time,
      price,
      covered: Math.max(0, price - a.amountPaid),
      amountPaid: a.amountPaid,
      paidAt: a.paidAt,
      notes: a.notes,
    });
  };

  const handleLeaveWaiting = async (entryId: string) => {
    const entry = (waiting ?? []).find((w) => w._id === entryId);
    if (!entry) return;
    setLeavingId(entryId);
    try {
      await leaveWaitingList({
        doctorId: entry.doctorId,
        date: entry.date,
      });
      toast.success("Vous avez quitté la liste d'attente.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Action impossible.",
      );
    } finally {
      setLeavingId(null);
    }
  };

  const now = new Date();
  const todayKey = toDateKey(now);
  const nowTime = format(now, "HH:mm");

  const isUpcoming = (a: AppointmentWithDetails) =>
    (a.status === "pending" || a.status === "confirmed") &&
    (a.date > todayKey || (a.date === todayKey && a.time >= nowTime));

  const upcoming = (items ?? []).filter(isUpcoming);
  const past = (items ?? []).filter((a) => !isUpcoming(a));
  const shown = filter === "upcoming" ? upcoming : past;

  const handleCancel = async (a: AppointmentWithDetails) => {
    setCancellingId(a._id);
    try {
      await cancelAppointment({ appointmentId: a._id });
      toast.success("Rendez-vous annulé.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Annulation impossible.",
      );
    } finally {
      setCancellingId(null);
    }
  };

  const empty = (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <CalendarX2 className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          {filter === "upcoming"
            ? "Aucun rendez-vous à venir"
            : "Aucun rendez-vous passé"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {filter === "upcoming"
            ? "Réservez votre première consultation en moins de deux minutes."
            : "Vos rendez-vous passés apparaîtront ici."}
        </p>
      </div>
      {filter === "upcoming" && (
        <Button onClick={onBook} className="mt-2 rounded-full">
          <CalendarPlus className="size-4" />
          Prendre rendez-vous
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Waiting list */}
      {waiting !== undefined && waiting.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-50/40 p-4 shadow-soft dark:bg-amber-500/[0.06]">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <BellRing className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Liste d'attente
              </p>
              <p className="text-xs text-muted-foreground">
                Vous serez prévenu·e par e-mail si un créneau se libère.
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {waiting.map((w) => (
              <div
                key={w._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {w.doctor?.name ?? "Praticien"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {w.service?.name ?? ""}
                    {w.service?.name && " · "}
                    {formatShortDate(w.date)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={leavingId === w._id}
                  onClick={() => handleLeaveWaiting(w._id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  {leavingId === w._id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    "Quitter"
                  )}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter pills */}
      <div className="flex w-fit items-center gap-1 rounded-full border border-border/70 bg-card p-1 shadow-soft">
        {FILTERS.map((f) => {
          const count = f.key === "upcoming" ? upcoming.length : past.length;
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-semibold",
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {items === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[76px] animate-pulse rounded-2xl border border-border/70 bg-card"
            />
          ))}
        </div>
      ) : shown.length === 0 ? (
        empty
      ) : (
        <div className="space-y-3">
          {shown.map((a) => (
            <AppointmentCard
              key={a._id}
              appointment={a}
              grid={grid}
              actions={
                <div className="flex items-center gap-1">
                  {a.amountPaid != null &&
                    (a.status === "confirmed" || a.status === "completed") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReceipt(a)}
                        className="text-muted-foreground hover:text-primary"
                        title={`Télécharger le reçu de ${formatPrice(a.amountPaid)}`}
                      >
                        <FileText className="size-3.5" />
                        Reçu
                      </Button>
                    )}
                  {isUpcoming(a) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={cancellingId === a._id}
                      onClick={() => handleCancel(a)}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      {cancellingId === a._id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        "Annuler"
                      )}
                    </Button>
                  )}
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
