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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  DAY_NAMES,
  DAY_SHORT_NAMES,
  doctorTint,
  formatFullDate,
  formatPrice,
  formatSchedule,
  initials,
  toDateKey,
  type DoctorScheduleEntry,
} from "@/lib/clinic";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  CalendarClock,
  CalendarOff,
  Coins,
  Loader2,
  Pencil,
  Phone,
  Plus,
  Stethoscope,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** A doctor as returned by `listDoctors` (with fiche fields). */
interface DoctorDoc {
  _id: Id<"doctors">;
  name: string;
  firstName?: string;
  lastName?: string;
  serviceId: Id<"services">;
  title: string;
  bio: string;
  phone?: string;
  consultationPrice?: number;
  schedule?: DoctorScheduleEntry[];
  color: string;
}

interface DoctorForm {
  firstName: string;
  lastName: string;
  serviceId: string;
  title: string;
  bio: string;
  phone: string;
  /** Consultation price, kept as a string while editing the input. */
  consultationPrice: string;
  schedule: DoctorScheduleEntry[];
}

const EMPTY_FORM: DoctorForm = {
  firstName: "",
  lastName: "",
  serviceId: "",
  title: "",
  bio: "",
  phone: "",
  consultationPrice: "",
  schedule: [],
};

export function StaffDoctors() {
  const doctors = useQuery(api.catalog.listDoctors);
  const services = useQuery(api.catalog.listServices);
  const offDays = useQuery(api.doctors.listDoctorOffDays);
  const createDoctor = useMutation(api.doctors.createDoctor);
  const updateDoctor = useMutation(api.doctors.updateDoctor);

  const [dialog, setDialog] = useState<
    | { mode: "create"; doctor: null }
    | { mode: "edit"; doctor: DoctorDoc }
    | null
  >(null);
  const [offDaysDoctor, setOffDaysDoctor] = useState<DoctorDoc | null>(null);

  const serviceName = (serviceId: Id<"services">) =>
    services?.find((s) => s._id === serviceId)?.name ?? "—";

  const handleSaved = () => {
    setDialog(null);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {doctors ? `${doctors.length} médecin${doctors.length === 1 ? "" : "s"}` : "…"}{" "}
          — la fiche renseigne les jours de vacation, le téléphone et le tarif
          de la consultation, affiché lors de la réservation.
        </p>
        <Button
          onClick={() => setDialog({ mode: "create", doctor: null })}
          className="shrink-0 rounded-full"
        >
          <Plus className="size-4" />
          Nouveau médecin
        </Button>
      </div>

      {/* List */}
      {doctors === undefined ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : doctors.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Stethoscope className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            Aucun médecin
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Créez la première fiche médecin : nom, prénom, spécialité,
            téléphone, tarif de consultation et jours de vacation.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {doctors.map((d) => (
            <Card
              key={d._id}
              className="flex flex-col border-border/70 p-5 shadow-soft transition-shadow hover:shadow-lifted"
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    doctorTint(d.color),
                  )}
                >
                  {initials(d.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">
                    {d.name}
                  </p>
                  <p className="truncate text-xs font-medium text-primary">
                    {serviceName(d.serviceId)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {d.title}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setOffDaysDoctor(d)}
                    className="size-8 shrink-0 text-muted-foreground hover:text-primary"
                    title="Congés et indisponibilités"
                  >
                    <CalendarOff className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDialog({ mode: "edit", doctor: d })}
                    className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
                    title="Modifier la fiche"
                  >
                    <Pencil className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-2 border-t border-border/70 pt-4 text-xs">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-3.5 shrink-0 text-primary" />
                  {d.phone || "Téléphone non renseigné"}
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Coins className="size-3.5 shrink-0 text-primary" />
                  {d.consultationPrice != null ? (
                    <span className="font-semibold text-foreground">
                      {formatPrice(d.consultationPrice)}
                    </span>
                  ) : (
                    "Tarif non renseigné"
                  )}
                  <span>la consultation</span>
                </p>
                <div className="flex items-start gap-2 text-muted-foreground">
                  <CalendarClock className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span className="leading-5">
                    {formatSchedule(d.schedule)}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {dialog && (
        <DoctorDialog
          key={
            dialog.mode === "edit" ? dialog.doctor._id : "new"
          }
          doctor={dialog.mode === "edit" ? dialog.doctor : null}
          services={services ?? []}
          onSave={async (form) => {
            const price = form.consultationPrice.trim();
            const payload = {
              firstName: form.firstName,
              lastName: form.lastName,
              serviceId: form.serviceId as Id<"services">,
              title: form.title,
              bio: form.bio,
              phone: form.phone,
              schedule: form.schedule,
              consultationPrice:
                price === "" ? undefined : Number(price),
            };
            if (dialog.mode === "edit") {
              await updateDoctor({
                doctorId: dialog.doctor._id,
                ...payload,
              });
            } else {
              await createDoctor(payload);
            }
            handleSaved();
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {offDaysDoctor && (
        <OffDaysDialog
          key={offDaysDoctor._id}
          doctor={offDaysDoctor}
          periods={offDays ?? []}
          onClose={() => setOffDaysDoctor(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Days off (congés / indisponibilités)                                */
/* ------------------------------------------------------------------ */

interface OffPeriod {
  _id: Id<"doctorOffDays">;
  doctorId: Id<"doctors">;
  startDate: string;
  endDate: string;
  reason?: string;
  doctor: { name: string; title: string; color: string } | null;
}

function OffDaysDialog({
  doctor,
  periods,
  onClose,
}: {
  doctor: DoctorDoc;
  periods: OffPeriod[];
  onClose: () => void;
}) {
  const addOffDays = useMutation(api.doctors.addDoctorOffDays);
  const removeOffDays = useMutation(api.doctors.removeDoctorOffDays);

  const [startDate, setStartDate] = useState(toDateKey(new Date()));
  const [endDate, setEndDate] = useState(toDateKey(new Date()));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<Id<"doctorOffDays"> | null>(
    null,
  );

  const mine = periods
    .filter((p) => p.doctorId === doctor._id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const handleAdd = async () => {
    if (!startDate || !endDate) {
      toast.error("Indiquez les dates du congé.");
      return;
    }
    setSaving(true);
    try {
      await addOffDays({
        doctorId: doctor._id,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });
      toast.success(
        "Congé enregistré — les créneaux de cette période sont fermés à la réservation.",
      );
      setStartDate(toDateKey(new Date()));
      setEndDate(toDateKey(new Date()));
      setReason("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: Id<"doctorOffDays">) => {
    setRemovingId(id);
    try {
      await removeOffDays({ offDaysId: id });
      toast.success("Période de congé supprimée.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Suppression impossible.",
      );
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Congés — {doctor.name}
          </DialogTitle>
          <DialogDescription>
            Pendant une période de congé, aucun créneau n'est proposé aux
            patients pour ce praticien.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add form */}
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Nouvelle période
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Du
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Au
                </Label>
                <Input
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Motif (optionnel)
                </Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex. Congé annuel, formation…"
                />
              </div>
            </div>
            <Button
              onClick={handleAdd}
              disabled={saving}
              size="sm"
              className="mt-3 rounded-full"
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Ajouter la période
            </Button>
          </div>

          {/* Existing periods */}
          {mine.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-background px-3 py-6 text-center text-xs text-muted-foreground">
              Aucun congé déclaré — tous les jours de vacation sont ouverts.
            </p>
          ) : (
            <ul className="space-y-2">
              {mine.map((p) => (
                <li
                  key={p._id}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3.5 py-2.5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CalendarOff className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {p.startDate === p.endDate
                        ? formatFullDate(p.startDate)
                        : `${formatFullDate(p.startDate)} → ${formatFullDate(p.endDate)}`}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.reason || "Indisponibilité"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={removingId === p._id}
                    onClick={() => handleRemove(p._id)}
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    title="Supprimer cette période"
                  >
                    {removingId === p._id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="rounded-full"
          >
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DoctorDialog({
  doctor,
  services,
  onSave,
  onClose,
}: {
  doctor: DoctorDoc | null;
  services: { _id: Id<"services">; name: string }[];
  onSave: (form: DoctorForm) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<DoctorForm>(() =>
    doctor
      ? {
          firstName: doctor.firstName ?? "",
          lastName: doctor.lastName ?? "",
          serviceId: doctor.serviceId,
          title: doctor.title ?? "",
          bio: doctor.bio ?? "",
          phone: doctor.phone ?? "",
          consultationPrice:
            doctor.consultationPrice != null
              ? String(doctor.consultationPrice)
              : "",
          schedule: doctor.schedule ?? [],
        }
      : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<DoctorForm>) =>
    setForm((f) => ({ ...f, ...patch }));

  const addSlot = () => {
    const usedDays = new Set(form.schedule.map((e) => e.day));
    const day =
      [1, 2, 3, 4, 5, 6, 0].find((d) => !usedDays.has(d)) ?? 1;
    set({
      schedule: [...form.schedule, { day, start: "09:00", end: "12:00" }],
    });
  };

  const updateSlot = (
    index: number,
    patch: Partial<DoctorScheduleEntry>,
  ) => {
    set({
      schedule: form.schedule.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    });
  };

  const removeSlot = (index: number) => {
    set({ schedule: form.schedule.filter((_, i) => i !== index) });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Indiquez le nom et le prénom du médecin.");
      return;
    }
    if (!form.serviceId) {
      setError("Choisissez la spécialité du médecin.");
      return;
    }
    const price = Number(form.consultationPrice);
    if (
      !form.consultationPrice.trim() ||
      !Number.isInteger(price) ||
      price <= 0
    ) {
      setError("Indiquez le prix de la consultation en FCFA (sans décimales).");
      return;
    }
    for (const e of form.schedule) {
      if (e.end <= e.start) {
        setError("Pour chaque vacation, l'heure de fin doit être après l'heure de début.");
        return;
      }
    }
    setSaving(true);
    try {
      await onSave({
        ...form,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
        schedule: form.schedule,
      });
      toast.success(
        doctor ? "Fiche médecin mise à jour." : "Médecin ajouté à l'équipe.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {doctor ? `Modifier la fiche — ${doctor.name}` : "Nouvelle fiche médecin"}
          </DialogTitle>
          <DialogDescription>
            Renseignez la spécialité, le téléphone et les jours et heures de
            vacation : ils déterminent la disponibilité du praticien.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom(s)">
              <Input
                value={form.firstName}
                onChange={(e) => set({ firstName: e.target.value })}
                placeholder="Camille"
                required
                disabled={saving}
              />
            </Field>
            <Field label="Nom">
              <Input
                value={form.lastName}
                onChange={(e) => set({ lastName: e.target.value })}
                placeholder="Moreau"
                required
                disabled={saving}
              />
            </Field>
          </div>

          <Field label="Spécialité">
            <Select
              value={form.serviceId}
              onValueChange={(v) => set({ serviceId: v })}
              disabled={saving}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir une spécialité" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Téléphone">
              <Input
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
                placeholder="+225 07 00 00 00 00"
                disabled={saving}
              />
            </Field>
            <Field label="Titre affiché">
              <Input
                value={form.title}
                onChange={(e) => set({ title: e.target.value })}
                placeholder="Médecin généraliste"
                disabled={saving}
              />
            </Field>
          </div>

          <Field label="Prix de la consultation (FCFA)">
            <div className="relative">
              <Coins className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                step={500}
                inputMode="numeric"
                value={form.consultationPrice}
                onChange={(e) => set({ consultationPrice: e.target.value })}
                placeholder="10 000"
                className="pl-9"
                disabled={saving}
              />
            </div>
            <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
              Montant en FCFA, sans décimales. Il s'affiche aux patients lors
              de la réservation et sert au calcul du paiement.
            </p>
          </Field>

          <Field label="Courte présentation (optionnel)">
            <Textarea
              value={form.bio}
              onChange={(e) => set({ bio: e.target.value })}
              rows={2}
              placeholder="Spécialité, expérience, approche…"
              className="resize-none"
              disabled={saving}
            />
          </Field>

          {/* Working hours */}
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Jours et heures de vacation
                </p>
                <p className="text-xs text-muted-foreground">
                  Les créneaux de réservation sont ouverts sur ces plages.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSlot}
                className="shrink-0 rounded-full"
              >
                <Plus className="size-3.5" />
                Ajouter
              </Button>
            </div>

            {form.schedule.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border bg-background px-3 py-6 text-center text-xs text-muted-foreground">
                Aucune vacation renseignée — les horaires par défaut de la
                clinique s'appliqueront.
              </p>
            ) : (
              <div className="space-y-2">
                {form.schedule.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-xl border border-border/70 bg-background p-2"
                  >
                    <Select
                      value={String(entry.day)}
                      onValueChange={(v) =>
                        updateSlot(i, { day: Number(v) })
                      }
                    >
                      <SelectTrigger className="h-9 w-[130px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAY_NAMES.map((name, day) => (
                          <SelectItem key={day} value={String(day)}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="time"
                      value={entry.start}
                      onChange={(e) => updateSlot(i, { start: e.target.value })}
                      className="h-9 w-[110px] text-xs"
                      aria-label="Heure de début"
                    />
                    <span className="text-xs text-muted-foreground">à</span>
                    <Input
                      type="time"
                      value={entry.end}
                      onChange={(e) => updateSlot(i, { end: e.target.value })}
                      className="h-9 w-[110px] text-xs"
                      aria-label="Heure de fin"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSlot(i)}
                      className="ml-auto size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      title="Supprimer cette vacation"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {form.schedule.length > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {form.schedule
                  .slice()
                  .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
                  .map((e) => `${DAY_SHORT_NAMES[e.day]} ${e.start}–${e.end}`)
                  .join(" · ")}
              </p>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-full"
              disabled={saving}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving} className="rounded-full">
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : doctor ? (
                "Enregistrer"
              ) : (
                "Créer la fiche"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
