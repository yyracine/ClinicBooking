import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  doctorTint,
  doctorWorksOn,
  formatFullDate,
  formatPrice,
  formatTimeRange,
  initials,
  serviceIcon,
  serviceTint,
  toDateKey,
} from "@/lib/clinic";
import { resolveConsultationPrice } from "@/lib/pricing";
import { useMutation, useQuery } from "convex/react";
import { startOfToday } from "date-fns";
import { fr } from "date-fns/locale";
import {
  BellRing,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Coins,
  Home,
  Loader2,
  Search,
  Smartphone,
  Stethoscope,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type Step = 1 | 2 | 3;

const STEP_TITLES: Record<Step, string> = {
  1: "Choisissez un service",
  2: "Sélectionnez un praticien",
  3: "Choisissez une date et un horaire",
};

function StepChip({
  step,
  current,
  done,
}: {
  step: Step;
  current: Step;
  done: boolean;
}) {
  return (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
        done
          ? "bg-primary text-primary-foreground"
          : current === step
            ? "bg-primary/10 text-primary ring-1 ring-primary/25"
            : "bg-muted text-muted-foreground",
      )}
    >
      {done ? <Check className="size-3.5" /> : step}
    </span>
  );
}

export function BookAppointment({
  onGoToMine,
}: {
  onGoToMine: () => void;
}) {
  const navigate = useNavigate();
  const services = useQuery(api.catalog.listServices);
  const doctors = useQuery(api.catalog.listDoctors);
  const grid = useQuery(api.settings.pricingGrid);

  const [serviceId, setServiceId] = useState<Id<"services"> | null>(null);
  const [doctorId, setDoctorId] = useState<Id<"doctors"> | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState<{
    service: string;
    doctor: string;
    date: string;
    time: string;
    price: number;
    durationMinutes: number;
  } | null>(null);

  const slots = useQuery(
    api.catalog.availableSlots,
    doctorId && date ? { doctorId, date } : "skip",
  );
  const bookAppointment = useMutation(api.appointments.bookAppointment);
  const joinWaitingList = useMutation(api.waitingList.joinWaitingList);
  const myWaiting = useQuery(api.waitingList.myWaitingList);
  const [waitingBusy, setWaitingBusy] = useState(false);
  const inWaiting =
    !!doctorId &&
    !!date &&
    (myWaiting ?? []).some(
      (w) => w.doctorId === doctorId && w.date === date,
    );

  const handleJoinWaiting = async () => {
    if (!doctorId || !date) return;
    setWaitingBusy(true);
    try {
      await joinWaitingList({ doctorId, date });
      toast.success(
        "Vous êtes inscrit·e en liste d'attente — vous serez prévenu·e si un créneau se libère.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Inscription impossible. Veuillez réessayer.",
      );
    } finally {
      setWaitingBusy(false);
    }
  };

  const selectedService = useMemo(
    () => services?.find((s) => s._id === serviceId) ?? null,
    [services, serviceId],
  );
  const selectedDoctor = useMemo(
    () => doctors?.find((d) => d._id === doctorId) ?? null,
    [doctors, doctorId],
  );
  const filteredDoctors = useMemo(
    () => doctors?.filter((d) => d.serviceId === serviceId) ?? [],
    [doctors, serviceId],
  );
  const queryServices = useMemo(() => {
    const q = serviceQuery.trim().toLocaleLowerCase("fr");
    if (!q || !services) return services ?? [];
    return services.filter((s) =>
      `${s.name} ${s.description}`.toLocaleLowerCase("fr").includes(q),
    );
  }, [services, serviceQuery]);

  const currentStep: Step = !selectedService ? 1 : !selectedDoctor ? 2 : 3;

  const stepDone = (step: Step) =>
    (step === 1 && !!selectedService) ||
    (step === 2 && !!selectedDoctor) ||
    (step === 3 && !!date && !!time);

  const canBook =
    !!selectedService && !!selectedDoctor && !!date && !!time && !booking;

  const handleConfirm = async () => {
    if (!selectedService || !selectedDoctor || !date || !time) return;
    setBooking(true);
    try {
      await bookAppointment({
        serviceId: selectedService._id,
        doctorId: selectedDoctor._id,
        date,
        time,
        notes: notes.trim() || undefined,
      });
      setBooked({
        service: selectedService.name,
        doctor: selectedDoctor.name,
        date,
        time,
        price: resolveConsultationPrice(
          selectedDoctor,
          selectedService,
          grid,
        ),
        durationMinutes: selectedService.durationMinutes,
      });
      toast.success("Rendez-vous enregistré !");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Une erreur est survenue. Veuillez réessayer.",
      );
    } finally {
      setBooking(false);
    }
  };

  const reset = () => {
    setServiceId(null);
    setDoctorId(null);
    setDate(null);
    setTime(null);
    setNotes("");
    setBooked(null);
  };

  /* ---------- Success state ---------- */
  if (booked) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="border-border/70 p-8 text-center shadow-lifted sm:p-10">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Check className="size-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Rendez-vous enregistré !
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre créneau est réservé : il restera « En attente » jusqu'au
            paiement à la clinique, le jour du rendez-vous. Vous pouvez
            l'annuler gratuitement jusqu'à 24 h avant.
          </p>
          <div className="mt-6 space-y-2.5 rounded-xl border border-border/70 bg-background p-4 text-left text-sm">
            <Row label="Service" value={booked.service} />
            <Row label="Praticien" value={booked.doctor} />
            <Row label="Date" value={formatFullDate(booked.date)} />
            <Row
              label="Horaire"
              value={formatTimeRange(booked.time, booked.durationMinutes)}
            />
            <Row label="Tarif" value={formatPrice(booked.price)} />
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <BellRing className="size-3.5 text-primary" />
            Vous recevrez une confirmation et des rappels par e-mail et SMS.
          </p>
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Button onClick={onGoToMine} className="rounded-full">
              Voir mes rendez-vous
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              onClick={reset}
              className="rounded-full"
            >
              Réserver un autre créneau
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mt-3 w-full rounded-full text-muted-foreground hover:text-foreground sm:mt-4"
          >
            <Home className="size-4" />
            Retour à l'accueil
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
      {/* ---------- Selection flow ---------- */}
      <div className="space-y-5">
        {/* Service */}
        <section
          className={cn(
            "rounded-2xl border bg-card p-5 shadow-soft transition-colors sm:p-6",
            currentStep === 1
              ? "border-primary/30 ring-1 ring-primary/10"
              : "border-border/70",
          )}
        >
          <div className="mb-4 flex items-center gap-3">
            <StepChip step={1} current={currentStep} done={stepDone(1)} />
            <h3 className="text-sm font-semibold text-foreground">
              {STEP_TITLES[1]}
            </h3>
          </div>
          {!services ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={serviceQuery}
                  onChange={(e) => setServiceQuery(e.target.value)}
                  placeholder="Rechercher un service…"
                  className="bg-background pl-9"
                />
              </div>
              {queryServices.length === 0 && (
                <p className="rounded-xl border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                  Aucun service ne correspond à «&nbsp;{serviceQuery}&nbsp;».
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {queryServices.map((s) => {
                  const Icon = serviceIcon(s.icon);
                  const selected = s._id === serviceId;
                  return (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() => {
                        setServiceId(s._id);
                        setDoctorId(null);
                        setDate(null);
                        setTime(null);
                      }}
                      className={cn(
                        "group flex flex-col items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200",
                        selected
                          ? "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/20"
                          : "border-border/70 bg-background hover:border-primary/25 hover:shadow-soft",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-10 items-center justify-center rounded-lg",
                          serviceTint(s.color),
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-foreground">
                          {s.name}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {s.description}
                        </span>
                      </span>
                      <span className="mt-auto flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {s.durationMinutes} min
                        </span>
                        <span className="text-foreground">
                          {formatPrice(s.price)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Doctor */}
        {selectedService && (
          <section
            className={cn(
              "rounded-2xl border bg-card p-5 shadow-soft transition-colors sm:p-6",
              currentStep === 2
                ? "border-primary/30 ring-1 ring-primary/10"
                : "border-border/70",
            )}
          >
            <div className="mb-4 flex items-center gap-3">
              <StepChip step={2} current={currentStep} done={stepDone(2)} />
              <h3 className="text-sm font-semibold text-foreground">
                {STEP_TITLES[2]}
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredDoctors.map((d) => {
                const selected = d._id === doctorId;
                return (
                  <button
                    key={d._id}
                    type="button"
                    onClick={() => {
                      setDoctorId(d._id);
                      setDate(null);
                      setTime(null);
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-4 text-left transition-all duration-200",
                      selected
                        ? "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/20"
                        : "border-border/70 bg-background hover:border-primary/25 hover:shadow-soft",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        doctorTint(d.color),
                      )}
                    >
                      {initials(d.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {d.name}
                        </span>
                        {selected && (
                          <Check className="size-4 shrink-0 text-primary" />
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-primary">
                        {d.title}
                      </span>
                      {d.schedule && d.schedule.length > 0 && (
                        <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                          {d.schedule
                            .slice()
                            .sort(
                              (a, b) =>
                                a.day - b.day || a.start.localeCompare(b.start),
                            )
                            .map(
                              (e) =>
                                `${["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][e.day]} ${e.start}–${e.end}`,
                            )
                            .join(" · ")}
                        </span>
                      )}
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {d.bio}
                      </span>
                      <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Coins className="size-3.5 text-primary" />
                        {selectedService
                          ? formatPrice(
                              resolveConsultationPrice(
                                d,
                                selectedService,
                                grid,
                              ),
                            )
                          : "—"}
                        <span className="font-normal text-muted-foreground">
                          la consultation
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Date + time */}
        {selectedDoctor && (
          <section
            className={cn(
              "rounded-2xl border bg-card p-5 shadow-soft transition-colors sm:p-6",
              currentStep === 3
                ? "border-primary/30 ring-1 ring-primary/10"
                : "border-border/70",
            )}
          >
            <div className="mb-4 flex items-center gap-3">
              <StepChip step={3} current={currentStep} done={stepDone(3)} />
              <h3 className="text-sm font-semibold text-foreground">
                {STEP_TITLES[3]}
              </h3>
            </div>
            <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
              <Calendar
                mode="single"
                locale={fr}
                selected={date ? new Date(`${date}T00:00:00`) : undefined}
                onSelect={(d) => {
                  setDate(d ? toDateKey(d) : null);
                  setTime(null);
                }}
                disabled={(d) => {
                  if (d < startOfToday()) return true;
                  if (!selectedDoctor) return d.getDay() === 0;
                  // Honor the doctor's vacation days from their fiche.
                  return !doctorWorksOn(selectedDoctor.schedule, d.getDay());
                }}
                className="rounded-xl border border-border/70"
              />
              <div className="min-w-0">
                <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <CalendarDays className="size-3.5" />
                  {date
                    ? formatFullDate(date)
                    : "Sélectionnez une date à gauche"}
                </p>
                {slots === undefined ? (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 rounded-lg" />
                    ))}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-background p-8 text-center">
                    <Stethoscope className="size-6 text-muted-foreground" />
                    <p className="text-sm font-medium text-foreground">
                      Aucun créneau disponible
                    </p>
                    <p className="max-w-xs text-xs text-muted-foreground">
                      {date
                        ? "Choisissez une autre date, ou inscrivez-vous en liste d'attente : vous serez prévenu·e si un créneau se libère."
                        : "Sélectionnez une date pour voir les horaires disponibles."}
                    </p>
                    {date && doctorId && (
                      <Button
                        type="button"
                        variant={inWaiting ? "outline" : "default"}
                        size="sm"
                        disabled={waitingBusy || inWaiting}
                        onClick={handleJoinWaiting}
                        className="mt-2 rounded-full"
                      >
                        {waitingBusy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : inWaiting ? (
                          <>
                            <Check className="size-4" />
                            Inscrit·e en liste d'attente
                          </>
                        ) : (
                          <>
                            <BellRing className="size-4" />
                            M'ajouter à la liste d'attente
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setTime(slot)}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-center text-sm font-medium transition-all duration-150",
                          time === slot
                            ? "border-primary bg-primary text-primary-foreground shadow-soft"
                            : "border-border/70 bg-background text-foreground hover:border-primary/30 hover:bg-primary/[0.04]",
                        )}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
                {time && selectedService && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    Consultation de {selectedService.durationMinutes} minutes,
                    de {time} à{" "}
                    {formatTimeRange(time, selectedService.durationMinutes)}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ---------- Summary sidebar ---------- */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Card className="border-border/70 p-5 shadow-soft sm:p-6">
          <h3 className="text-sm font-bold tracking-tight text-foreground">
            Récapitulatif
          </h3>
          <div className="mt-4 space-y-3 text-sm">
            <SummaryRow
              label="Service"
              value={selectedService?.name}
              placeholder="À choisir"
            />
            <SummaryRow
              label="Praticien"
              value={selectedDoctor?.name}
              placeholder="À choisir"
            />
            <SummaryRow
              label="Date"
              value={date ? formatFullDate(date) : undefined}
              placeholder="À choisir"
            />
            <SummaryRow
              label="Horaire"
              value={
                time && selectedService
                  ? formatTimeRange(time, selectedService.durationMinutes)
                  : undefined
              }
              placeholder="À choisir"
            />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-4 text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-bold text-foreground">
              {selectedService && selectedDoctor
                ? formatPrice(
                    resolveConsultationPrice(
                      selectedDoctor,
                      selectedService,
                      grid,
                    ),
                  )
                : selectedService
                  ? formatPrice(selectedService.price)
                  : "—"}
            </span>
          </div>

          <div className="mt-4">
            <label
              htmlFor="booking-notes"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              Remarques (optionnel)
            </label>
            <Textarea
              id="booking-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Allergies, motif de consultation…"
              rows={3}
              className="resize-none"
            />
          </div>

          <Button
            onClick={handleConfirm}
            disabled={!canBook}
            className="mt-4 w-full rounded-full"
          >
            {booking ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Réservation en cours…
              </>
            ) : (
              <>
                Confirmer le rendez-vous
                <ChevronRight className="size-4" />
              </>
            )}
          </Button>
          <p className="mt-3 text-center text-[11px] leading-4 text-muted-foreground">
            Annulation gratuite jusqu'à 24 h avant le rendez-vous.
          </p>
          <div className="mt-4 space-y-2 rounded-xl border border-border/70 bg-muted/30 p-3 text-[11px] leading-4 text-muted-foreground">
            <p className="flex items-start gap-1.5">
              <BellRing className="mt-0.5 size-3.5 shrink-0 text-primary" />
              Confirmation et rappels automatiques par e-mail et SMS (J-7,
              J-3 et la veille).
            </p>
            <p className="flex items-start gap-1.5">
              <Smartphone className="mt-0.5 size-3.5 shrink-0 text-primary" />
              Paiement sur place, ou par mobile money (Orange Money · MTN
              MoMo · Wave) directement depuis votre téléphone.
            </p>
          </div>
        </Card>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  placeholder,
}: {
  label: string;
  value?: string;
  placeholder: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      {value ? (
        <span className="text-right text-xs font-semibold text-foreground">
          {value}
        </span>
      ) : (
        <span className="text-right text-xs italic text-muted-foreground/70">
          {placeholder}
        </span>
      )}
    </div>
  );
}
