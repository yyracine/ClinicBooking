import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InsuranceSummary } from "@/components/dashboard/MyRecord";
import { StaffCalendar } from "@/components/dashboard/StaffCalendar";
import {
  appointmentsToCsv,
  filterAppointments,
  searchAppointments,
} from "@/lib/csv";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  STATUS_LABELS,
  STATUS_ORDER,
  appointmentPrice,
  formatFullDate,
  formatPrice,
  formatShortDate,
  formatTimeRange,
  serviceIcon,
  serviceTint,
  toDateKey,
  type AppointmentStatus,
  type StaffAppointment,
} from "@/lib/clinic";
import { computePatientShare } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Banknote,
  BellRing,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CircleCheck,
  Download,
  Hourglass,
  Loader2,
  Search,
  Send,
  Smartphone,
  Table2,
  TriangleAlert,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "today", label: "Aujourd'hui" },
  { key: "pending", label: "En attente" },
  { key: "upcoming", label: "À venir" },
  { key: "completed", label: "Terminés" },
  { key: "cancelled", label: "Annulés" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export function StaffPlanning() {
  const items = useQuery(api.appointments.allAppointments);
  const grid = useQuery(api.settings.pricingGrid);
  const offDays = useQuery(api.doctors.listDoctorOffDays);
  const updateStatus = useMutation(api.appointments.updateAppointmentStatus);
  const waitingList = useQuery(api.waitingList.staffWaitingList);
  const [view, setView] = useState<"table" | "calendar">("table");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [paymentTarget, setPaymentTarget] =
    useState<StaffAppointment | null>(null);
  const [staffBookOpen, setStaffBookOpen] = useState(false);
  const [waitingOpen, setWaitingOpen] = useState(false);

  const waitingCount = (waitingList ?? []).length;

  const todayKey = toDateKey(new Date());

  const stats = useMemo(() => {
    const all = items ?? [];
    const upcomingStatuses = (a: StaffAppointment) =>
      (a.status === "pending" || a.status === "confirmed") &&
      a.date >= todayKey;
    return {
      today: all.filter((a) => a.date === todayKey).length,
      pending: all.filter(
        (a) => a.status === "pending" && a.date >= todayKey,
      ).length,
      upcoming: all.filter(upcomingStatuses).length,
      total: all.length,
      collected: all.reduce((sum, a) => sum + (a.amountPaid ?? 0), 0),
    };
  }, [items, todayKey]);

  const shown = useMemo(
    () => filterAppointments(items ?? [], filter, todayKey),
    [items, filter, todayKey],
  );

  const filtered = useMemo(
    () => searchAppointments(shown, query),
    [shown, query],
  );

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.time.localeCompare(a.time);
      }),
    [filtered],
  );

  /** Download the currently filtered appointments as a CSV file (Excel FR). */
  const exportCsv = () => {
    const rows = sorted.map((a) => ({
      date: a.date,
      time: a.time,
      patientName: a.patient.name,
      patientEmail: a.patient.email,
      serviceName: a.service?.name,
      doctorName: a.doctor?.name,
      statusLabel: STATUS_LABELS[a.status],
      amountPaid: a.amountPaid,
      notes: a.notes,
    }));
    const csv = appointmentsToCsv(rows);
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rendez-vous-${toDateKey(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} rendez-vous exportés.`);
  };

  const handleStatusChange = async (
    a: StaffAppointment,
    status: AppointmentStatus,
  ) => {
    if (status === a.status) return;
    setUpdatingId(a._id);
    try {
      await updateStatus({ appointmentId: a._id, status });
      toast.success(
        `Rendez-vous de ${a.patient.name ?? "patient"} marqué « ${STATUS_LABELS[status]} ».`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Mise à jour impossible.",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          icon={<CalendarDays className="size-4" />}
          label="Aujourd'hui"
          value={stats.today}
        />
        <StatCard
          icon={<Hourglass className="size-4" />}
          label="En attente"
          value={stats.pending}
        />
        <StatCard
          icon={<CalendarClock className="size-4" />}
          label="À venir"
          value={stats.upcoming}
        />
        <StatCard
          icon={<CalendarCheck2 className="size-4" />}
          label="Au total"
          value={stats.total}
        />
        <StatCard
          icon={<Wallet className="size-4" />}
          label="Encaissé"
          value={formatPrice(stats.collected)}
          className="text-primary"
        />
      </div>

      {/* Toolbar: view toggle + actions */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex w-fit items-center gap-1 rounded-full border border-border/70 bg-card p-1 shadow-soft">
            {(["table", "calendar"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all sm:text-sm",
                  view === v
                    ? "bg-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "table" ? (
                  <Table2 className="size-3.5" />
                ) : (
                  <CalendarRange className="size-3.5" />
                )}
                {v === "table" ? "Tableau" : "Calendrier"}
              </button>
            ))}
          </div>
          {view === "calendar" && (
            <p className="hidden text-xs text-muted-foreground md:inline">
              Vue d'ensemble de la semaine et du mois — les jours de congé
              apparaissent en ambre.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setWaitingOpen(true)}
            className="h-8 rounded-full border-amber-500/30 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
          >
            <BellRing className="size-3.5" />
            Liste d'attente
            {waitingCount > 0 && (
              <span className="flex size-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {waitingCount}
              </span>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportCsv}
            className="h-8 rounded-full"
            title="Exporter la vue actuelle en CSV (Excel)"
          >
            <Download className="size-3.5" />
            Exporter CSV
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => setStaffBookOpen(true)}
            className="h-8 rounded-full"
          >
            <UserPlus className="size-3.5" />
            Nouveau RDV
          </Button>
        </div>
      </div>

      {view === "table" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un patient, un service…"
              className="bg-background pl-9"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
              {sorted.length} rendez-vous
            </span>
            <div className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border/70 bg-card p-1 shadow-soft">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all sm:text-sm",
                    filter === f.key
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Calendar view */}
      {view === "calendar" ? (
        items === undefined || offDays === undefined ? (
          <div className="h-72 animate-pulse rounded-2xl border border-border/70 bg-card" />
        ) : (
          <StaffCalendar appointments={items} offDays={offDays} />
        )
      ) : items === undefined ? (
        <div className="space-y-2 overflow-hidden rounded-2xl border border-border/70 bg-card p-3 shadow-soft">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-xl bg-muted/60"
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <CalendarCheck2 className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {query
              ? "Aucun résultat pour cette recherche"
              : "Aucun rendez-vous"}
          </p>
          <p className="text-xs text-muted-foreground">
            {query
              ? "Essayez un autre nom de patient, de service ou de praticien."
              : "Les rendez-vous réservés par les patients apparaîtront ici."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
          <Table className="min-w-[840px]">
            <TableHeader>
              <TableRow className="border-0 bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Date
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Heure
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Patient
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Service
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Praticien
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Paiement
                </TableHead>
                <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Statut
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((a) => {
                const Icon = serviceIcon(a.service?.icon);
                const updating = updatingId === a._id;
                return (
                  <TableRow key={a._id} className="group">
                    <TableCell className="px-4 py-3">
                      <span className="text-sm font-medium text-foreground">
                        {formatShortDate(a.date)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 text-sm text-muted-foreground">
                      {a.service
                        ? formatTimeRange(a.time, a.service.durationMinutes)
                        : a.time}
                    </TableCell>
                    <TableCell className="max-w-[220px] py-3">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {a.patient.name ?? "Patient"}
                        </p>
                        {a.hasAllergies && (
                          <span
                            title={
                              a.allergies && a.allergies.length > 0
                                ? `Allergies : ${a.allergies.join(", ")}`
                                : "Allergie déclarée dans la fiche patient"
                            }
                            className="flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400"
                          >
                            <TriangleAlert className="size-3" />
                          </span>
                        )}
                      </div>
                      {a.patient.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {a.patient.email}
                        </p>
                      )}
                      {a.hasAllergies && (
                        <p className="mt-0.5 truncate text-[11px] font-medium text-amber-600 dark:text-amber-400">
                          ⚠ {a.allergies && a.allergies.length > 0
                            ? a.allergies.join(", ")
                            : "Allergie"}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-md",
                            serviceTint(a.service?.icon),
                          )}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <span className="text-sm text-foreground">
                          {a.service?.name ?? "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <p className="text-sm font-medium text-foreground">
                        {a.doctor?.name ?? "—"}
                      </p>
                      {a.doctor?.title && (
                        <p className="text-xs text-muted-foreground">
                          {a.doctor.title}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {a.status === "pending" ? (
                        <div className="flex flex-col items-start gap-1.5">
                          <span className="text-sm font-bold text-foreground">
                            {formatPrice(
                              computePatientShare(
                                appointmentPrice(a, grid),
                                a.insurance,
                              ),
                            )}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setPaymentTarget(a)}
                            className="h-7 gap-1 rounded-full border-primary/30 px-2.5 text-xs font-medium text-primary hover:bg-primary/10"
                          >
                            <Banknote className="size-3.5" />
                            Valider le paiement
                          </Button>
                        </div>
                      ) : a.amountPaid != null ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          <CircleCheck className="size-4" />
                          {formatPrice(a.amountPaid)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {updating && (
                          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                        )}
                        <Select
                          value={a.status}
                          onValueChange={(v) =>
                            handleStatusChange(a, v as AppointmentStatus)
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            className="h-8 w-[110px] rounded-full border-border/70 text-xs"
                            aria-label="Modifier le statut"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_ORDER.map((s) => (
                              <SelectItem
                                key={s}
                                value={s}
                                // "Confirmé" is only reachable by validating
                                // the payment — it stays visible (and
                                // displayed when already confirmed) but
                                // cannot be picked here.
                                disabled={s === "confirmed"}
                              >
                                {STATUS_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Payment validation dialog */}
      {paymentTarget && (
        <PaymentDialog
          key={paymentTarget._id}
          appointment={paymentTarget}
          open
          onOpenChange={(open) => {
            if (!open) setPaymentTarget(null);
          }}
        />
      )}

      {/* Book for a patient without account (phone / walk-in) */}
      <StaffBookDialog open={staffBookOpen} onOpenChange={setStaffBookOpen} />

      {/* Waiting list management */}
      <WaitingListDialog open={waitingOpen} onOpenChange={setWaitingOpen} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <Card className="border-border/70 p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        {label}
      </div>
      <p
        className={cn(
          "mt-3 text-2xl font-bold tracking-tight text-foreground",
          className,
        )}
      >
        {value}
      </p>
    </Card>
  );
}

function PaymentDialog({
  appointment,
  open,
  onOpenChange,
}: {
  appointment: StaffAppointment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const recordPayment = useMutation(api.appointments.recordPayment);
  const integration = useQuery(api.payments.getIntegrationStatus);
  const grid = useQuery(api.settings.pricingGrid);
  const requestMobilePayment = useAction(
    api.payments.createMobilePaymentRequest,
  );
  const recordMobilePayment = useMutation(api.payments.recordMobilePayment);
  const [paying, setPaying] = useState(false);
  const [mobileBusy, setMobileBusy] = useState(false);
  const [mobileResult, setMobileResult] = useState<
    | { demo: boolean; amount: number; transactionId: string; checkoutUrl: string | null; message: string }
    | null
  >(null);

  const price = appointmentPrice(appointment, grid);
  const share = computePatientShare(price, appointment.insurance);
  const covered = price - share;
  const patientPhone = appointment.patient.phone;
  const mobileConfigured = integration?.mobileMoney ?? false;

  /** Create a mobile money request (Orange Money / MTN MoMo / Wave). */
  const handleMobileRequest = async () => {
    setMobileBusy(true);
    setMobileResult(null);
    try {
      const res = await requestMobilePayment({
        appointmentId: appointment._id,
      });
      setMobileResult(res);
      if (res.demo) {
        toast.info(
          `Mode démo : demande de ${formatPrice(res.amount)} créée pour ${res.phone}. Configurez vos clés CinetPay pour activer le paiement réel.`,
        );
      } else {
        toast.success("Demande de paiement créée — envoyez le lien au patient.");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Demande impossible.",
      );
    } finally {
      setMobileBusy(false);
    }
  };

  /** The patient paid by mobile money: record it and confirm the booking. */
  const handleMobileRecorded = async () => {
    setMobileBusy(true);
    try {
      const res = await recordMobilePayment({
        appointmentId: appointment._id,
      });
      toast.success(
        `Paiement mobile de ${formatPrice(res.amountPaid)} confirmé — rendez-vous confirmé.`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Confirmation impossible.",
      );
    } finally {
      setMobileBusy(false);
    }
  };

  const handleConfirm = async () => {
    setPaying(true);
    try {
      const res = await recordPayment({
        appointmentId: appointment._id,
      });
      toast.success(
        `Paiement de ${formatPrice(res.amountPaid)} encaissé — rendez-vous confirmé.`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Encaissement impossible.",
      );
    } finally {
      setPaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Valider le paiement</DialogTitle>
          <DialogDescription>
            Le montant est calculé d'après le tarif du praticien et les données
            d'assurance du patient.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
          <PayRow
            label="Patient"
            value={appointment.patient.name ?? "Patient"}
          />
          <PayRow
            label="Consultation"
            value={`${appointment.doctor?.name ?? appointment.service?.name ?? "—"} · ${formatPrice(price)}`}
          />
          <PayRow label="Date" value={formatFullDate(appointment.date)} />

          <div className="border-t border-border/70 pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Assurance
            </p>
            <div className="mt-1">
              <InsuranceSummary
                profile={appointment.insurance ?? { insured: false }}
              />
            </div>
          </div>

          <div className="space-y-2 border-t border-border/70 pt-3">
            <PayRow
              label="Montant du service"
              value={formatPrice(price)}
            />
            <PayRow
              label="Pris en charge par l'assurance"
              value={`− ${formatPrice(covered)}`}
              className="text-emerald-600 dark:text-emerald-400"
            />
            <div className="flex items-center justify-between border-t border-border/70 pt-3">
              <span className="text-sm font-semibold text-foreground">
                À encaisser
              </span>
              <span className="text-lg font-bold tracking-tight text-foreground">
                {formatPrice(share)}
              </span>
            </div>
          </div>
        </div>

        {/* Paiement mobile (Orange Money / MTN MoMo / Wave) */}
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Smartphone className="size-4 text-primary" />
              Paiement mobile
            </p>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                mobileConfigured
                  ? "bg-teal-500/15 text-teal-700 dark:text-teal-300"
                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
              )}
            >
              {mobileConfigured ? "Actif" : "Mode démo"}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Envoyez une demande de paiement au patient : il règle directement
            depuis son téléphone (Orange Money · MTN MoMo · Wave).
          </p>

          {mobileResult && (
            <div className="mt-3 rounded-xl border border-border/70 bg-background px-3.5 py-2.5 text-xs leading-5">
              <p className="font-semibold text-foreground">
                Demande {mobileResult.demo ? "(mode démo)" : "créée"} —{" "}
                {formatPrice(mobileResult.amount)}
              </p>
              <p className="mt-0.5 break-all text-muted-foreground">
                Réf. {mobileResult.transactionId}
              </p>
              {mobileResult.checkoutUrl && (
                <a
                  href={mobileResult.checkoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                >
                  <Send className="size-3.5" />
                  Ouvrir le lien de paiement
                </a>
              )}
              {mobileResult.demo && (
                <p className="mt-1.5 text-amber-600 dark:text-amber-400">
                  Configurez les clés CinetPay (onglet « Keys ») pour envoyer de
                  vraies demandes.
                </p>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-col gap-2">
            {!patientPhone ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-2 text-[11px] leading-4 text-muted-foreground">
                Le patient n'a pas de numéro de téléphone dans sa fiche —
                complétez-la avant de lancer un paiement mobile.
              </p>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleMobileRequest}
                  disabled={mobileBusy}
                  className="h-8 justify-start gap-1.5 rounded-full text-xs"
                >
                  {mobileBusy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Smartphone className="size-3.5" />
                  )}
                  Demander le paiement ({patientPhone})
                </Button>
                {mobileResult && !mobileResult.demo && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleMobileRecorded}
                    disabled={mobileBusy}
                    className="h-8 justify-start gap-1.5 rounded-full text-xs text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                  >
                    <CircleCheck className="size-3.5" />
                    Le patient a payé — confirmer
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full"
          >
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={paying}
            className="rounded-full"
          >
            {paying ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Banknote className="size-4" />
            )}
            {share > 0
              ? `Encaisser ${formatPrice(share)}`
              : "Confirmer le paiement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayRow({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right font-medium text-foreground", className)}>
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Staff book appointment (P4): book for an existing patient or create  */
/* a minimal record card on the fly (phone / walk-in).                  */
/* ------------------------------------------------------------------ */

function StaffBookDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const services = useQuery(api.catalog.listServices);
  const doctors = useQuery(api.catalog.listDoctors);
  const staffBookAppointment = useMutation(
    api.appointments.staffBookAppointment,
  );

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [serviceId, setServiceId] = useState<Id<"services"> | null>(null);
  const [doctorId, setDoctorId] = useState<Id<"doctors"> | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const [existingPatientId, setExistingPatientId] = useState<
    Id<"users"> | null
  >(null);
  const [newPatient, setNewPatient] = useState({
    lastName: "",
    firstName: "",
    phone: "",
    birthDate: "",
    email: "",
  });
  const [saving, setSaving] = useState(false);

  const patients = useQuery(api.records.searchPatients, {
    query: patientQuery,
  });
  const slots = useQuery(
    api.catalog.availableSlots,
    doctorId && date ? { doctorId, date } : "skip",
  );

  const filteredDoctors = doctors?.filter(
    (d) => d.serviceId === serviceId,
  ) ?? [];
  const canSubmit =
    !!serviceId &&
    !!doctorId &&
    !!date &&
    !!time &&
    !saving &&
    (mode === "existing"
      ? !!existingPatientId
      : newPatient.lastName.trim() &&
        newPatient.firstName.trim() &&
        newPatient.phone.trim() &&
        newPatient.birthDate);

  const reset = () => {
    setMode("existing");
    setServiceId(null);
    setDoctorId(null);
    setDate("");
    setTime(null);
    setNotes("");
    setPatientQuery("");
    setExistingPatientId(null);
    setNewPatient({
      lastName: "",
      firstName: "",
      phone: "",
      birthDate: "",
      email: "",
    });
  };

  const handleSubmit = async () => {
    if (!serviceId || !doctorId || !date || !time) return;
    setSaving(true);
    try {
      const res = await staffBookAppointment({
        serviceId,
        doctorId,
        date,
        time,
        notes: notes.trim() || undefined,
        ...(mode === "existing" && existingPatientId
          ? { existingPatientId }
          : {
              newPatient: {
                lastName: newPatient.lastName,
                firstName: newPatient.firstName,
                phone: newPatient.phone,
                birthDate: newPatient.birthDate,
                email: newPatient.email.trim() || undefined,
              },
            }),
      });
      toast.success(
        `Rendez-vous créé pour ${res.patientName} (${formatFullDate(date)} à ${time}).`,
      );
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Création impossible.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          onOpenChange(false);
        } else {
          onOpenChange(true);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Créer un rendez-vous</DialogTitle>
          <DialogDescription>
            Pour un patient reçu par téléphone ou sans compte : choisissez le
            service, le praticien et le créneau.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Service / doctor / date */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Service
              </Label>
              <Select
                value={serviceId ?? ""}
                onValueChange={(v) => {
                  setServiceId(v as Id<"services">);
                  setDoctorId(null);
                  setTime(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir un service" />
                </SelectTrigger>
                <SelectContent>
                  {(services ?? []).map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.name} — {formatPrice(s.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Praticien
              </Label>
              <Select
                value={doctorId ?? ""}
                onValueChange={(v) => {
                  setDoctorId(v as Id<"doctors">);
                  setTime(null);
                }}
                disabled={!serviceId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      serviceId ? "Choisir un praticien" : "Service d'abord"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {filteredDoctors.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name} — {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Date
              </Label>
              <Input
                type="date"
                value={date}
                min={toDateKey(new Date())}
                onChange={(e) => {
                  setDate(e.target.value);
                  setTime(null);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Horaire
              </Label>
              {!date ? (
                <div className="flex h-9 items-center rounded-lg border border-dashed border-border px-3 text-xs text-muted-foreground">
                  Choisissez une date
                </div>
              ) : slots === undefined ? (
                <div className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Créneaux…
                </div>
              ) : (
                <Select
                  value={time ?? ""}
                  onValueChange={setTime}
                  disabled={slots.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        slots.length === 0
                          ? "Aucun créneau"
                          : "Choisir un créneau"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {slots.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Patient */}
          <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Patient
              </p>
              <div className="flex w-fit items-center gap-1 rounded-full border border-border/70 bg-background p-0.5">
                {(["existing", "new"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setExistingPatientId(null);
                    }}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-medium transition-all",
                      mode === m
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m === "existing" ? "Fiche existante" : "Nouveau patient"}
                  </button>
                ))}
              </div>
            </div>

            {mode === "existing" ? (
              <div className="space-y-2">
                <Input
                  type="search"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="Rechercher par nom, prénom ou n° de dossier…"
                />
                {patients === undefined ? (
                  <p className="text-xs text-muted-foreground">Chargement…</p>
                ) : patients.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aucune fiche trouvée — passez en « Nouveau patient ».
                  </p>
                ) : (
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {patients.map((p) => {
                      const selected = p.userId === existingPatientId;
                      return (
                        <button
                          key={p._id}
                          type="button"
                          onClick={() =>
                            setExistingPatientId(
                              selected ? null : p.userId,
                            )
                          }
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                            selected
                              ? "border-primary/40 bg-primary/[0.05]"
                              : "border-border/60 bg-background hover:border-primary/25",
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {p.firstName} {p.lastName}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {p.dossierNumber}
                              {p.phone ? ` · ${p.phone}` : ""}
                            </span>
                          </span>
                          {selected && (
                            <CircleCheck className="size-4 shrink-0 text-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Input
                  placeholder="Nom"
                  value={newPatient.lastName}
                  onChange={(e) =>
                    setNewPatient({ ...newPatient, lastName: e.target.value })
                  }
                />
                <Input
                  placeholder="Prénom"
                  value={newPatient.firstName}
                  onChange={(e) =>
                    setNewPatient({ ...newPatient, firstName: e.target.value })
                  }
                />
                <Input
                  placeholder="Téléphone"
                  type="tel"
                  value={newPatient.phone}
                  onChange={(e) =>
                    setNewPatient({ ...newPatient, phone: e.target.value })
                  }
                />
                <Input
                  placeholder="Date de naissance"
                  type="date"
                  value={newPatient.birthDate}
                  onChange={(e) =>
                    setNewPatient({
                      ...newPatient,
                      birthDate: e.target.value,
                    })
                  }
                />
                <Input
                  placeholder="E-mail (optionnel)"
                  type="email"
                  value={newPatient.email}
                  onChange={(e) =>
                    setNewPatient({ ...newPatient, email: e.target.value })
                  }
                  className="sm:col-span-2"
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Remarques (optionnel)
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Motif, notes de rendez-vous…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            className="rounded-full"
          >
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-full"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            Créer le rendez-vous
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Waiting list (P2): assign a freed slot to the first patient in line. */
/* ------------------------------------------------------------------ */

interface WaitingEntry {
  _id: Id<"waitingList">;
  userId: Id<"users">;
  doctorId: Id<"doctors">;
  date: string;
  createdAt: number;
  name: string;
  phone: string | null;
  doctorName: string;
  doctorTitle: string;
  doctorColor: string;
  serviceName: string;
}

function WaitingListDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const entries = useQuery(api.waitingList.staffWaitingList);
  const [assignTarget, setAssignTarget] = useState<WaitingEntry | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Liste d'attente</DialogTitle>
          <DialogDescription>
            Les patients inscrits attendent un créneau libéré — attribuez-leur
            une place dès qu'un rendez-vous est annulé.
          </DialogDescription>
        </DialogHeader>

        {entries === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl border border-border/70 bg-card"
              />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
            <BellRing className="size-6 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              Personne en attente
            </p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Les patients s'inscrivent ici quand tous les créneaux d'un
              praticien sont pris.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div
                key={e._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {e.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.serviceName}
                    {e.serviceName ? " · " : ""}
                    {e.doctorName}
                    {e.phone ? ` · ${e.phone}` : ""}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                    {formatShortDate(e.date)} · inscrit·e le{" "}
                    {formatShortDate(toDateKey(new Date(e.createdAt)))}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAssignTarget(e)}
                  className="h-8 shrink-0 rounded-full border-primary/30 text-primary hover:bg-primary/10"
                >
                  Attribuer
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>

      {assignTarget && (
        <AssignSlotDialog
          entry={assignTarget}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </Dialog>
  );
}

function AssignSlotDialog({
  entry,
  onClose,
}: {
  entry: WaitingEntry;
  onClose: () => void;
}) {
  const slots = useQuery(api.catalog.availableSlots, {
    doctorId: entry.doctorId,
    date: entry.date,
  });
  const assignWaitingSlot = useMutation(api.waitingList.assignWaitingSlot);
  const [time, setTime] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const handleAssign = async () => {
    if (!time) return;
    setAssigning(true);
    try {
      await assignWaitingSlot({
        doctorId: entry.doctorId,
        date: entry.date,
        time,
      });
      toast.success(
        `Créneau ${time} attribué à ${entry.name} — il a reçu un e-mail de confirmation.`,
      );
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Attribution impossible.",
      );
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Attribuer un créneau</DialogTitle>
          <DialogDescription>
            {entry.name} — {entry.serviceName} · {entry.doctorName} ·{" "}
            {formatFullDate(entry.date)}
          </DialogDescription>
        </DialogHeader>

        {slots === undefined ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : slots.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <Users className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Aucun créneau n'est libre ce jour-là pour ce praticien.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {slots.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setTime(s)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-center text-sm font-medium transition-all",
                  time === s
                    ? "border-primary bg-primary text-primary-foreground shadow-soft"
                    : "border-border/70 bg-background text-foreground hover:border-primary/30 hover:bg-primary/[0.04]",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-full">
            Annuler
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!time || assigning}
            className="rounded-full"
          >
            {assigning ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <BellRing className="size-4" />
            )}
            Attribuer {time ?? ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
