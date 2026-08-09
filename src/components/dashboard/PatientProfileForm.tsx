import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { Droplets, FileHeart, Loader2, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BLOOD_GROUPS, toDateKey } from "@/lib/clinic";

type StringField =
  | "email"
  | "lastName"
  | "firstName"
  | "birthDate"
  | "phone"
  | "emergencyName"
  | "emergencyPhone"
  | "address"
  | "city"
  | "postalCode"
  | "notes"
  | "allergies"
  | "antecedents"
  | "bloodGroup"
  | "familyHistory"
  | "surgicalHistory"
  | "currentTreatments"
  | "insuranceName"
  | "reimbursementRate";

type BoolField = "insured" | "reimbursement100" | "tiersPayant";

const EMPTY = {
  lastName: "",
  firstName: "",
  birthDate: "",
  phone: "",
  emergencyName: "",
  emergencyPhone: "",
  address: "",
  city: "",
  postalCode: "",
  notes: "",
  allergies: "",
  antecedents: "",
  bloodGroup: "",
  familyHistory: "",
  surgicalHistory: "",
  currentTreatments: "",
  insured: false,
  insuranceName: "",
  reimbursement100: false,
  tiersPayant: false,
  reimbursementRate: "",
};

export function PatientProfileForm({ onDone }: { onDone: () => void }) {
  const createProfile = useMutation(api.records.createProfile);
  const { user } = useAuth();
  const accountEmail = user?.email ?? "";
  const [form, setForm] = useState({
    ...EMPTY,
    email: accountEmail,
  });
  const [saving, setSaving] = useState(false);

  const set = (key: StringField) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggle = (key: BoolField) => (value: boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (form.insured && !form.insuranceName.trim()) {
      toast.error("Indiquez le nom de votre assurance.");
      return;
    }
    const rate = form.reimbursementRate.trim()
      ? Number(form.reimbursementRate)
      : undefined;
    if (rate !== undefined && (Number.isNaN(rate) || rate < 0 || rate > 100)) {
      toast.error("Le taux de remboursement doit être entre 0 et 100.");
      return;
    }

    setSaving(true);
    try {
      await createProfile({
        email: form.email.trim() || undefined,
        lastName: form.lastName,
        firstName: form.firstName,
        birthDate: form.birthDate,
        phone: form.phone,
        emergencyName: form.emergencyName.trim() || undefined,
        emergencyPhone: form.emergencyPhone.trim() || undefined,
        address: form.address,
        city: form.city,
        postalCode: form.postalCode.trim() || undefined,
        notes: form.notes.trim() || undefined,
        allergies: splitList(form.allergies),
        antecedents: splitList(form.antecedents),
        bloodGroup: form.bloodGroup.trim() || undefined,
        familyHistory: splitList(form.familyHistory),
        surgicalHistory: splitList(form.surgicalHistory),
        currentTreatments: splitList(form.currentTreatments),
        insured: form.insured,
        insuranceName: form.insured
          ? form.insuranceName.trim() || undefined
          : undefined,
        reimbursement100: form.insured ? form.reimbursement100 : undefined,
        tiersPayant: form.insured ? form.tiersPayant : undefined,
        reimbursementRate: form.insured ? rate : undefined,
      });
      toast.success("Fiche patient créée — votre dossier médical est ouvert !");
      onDone();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Une erreur est survenue.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-2xl border-border/70 p-6 shadow-lifted sm:p-8">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <FileHeart className="size-7 text-primary" />
        </div>
        <h1 className="text-center text-xl font-bold tracking-tight text-foreground">
          Votre fiche patient
        </h1>
        <div className="mx-auto mt-4 flex max-w-md items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs leading-5 text-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            Pour finaliser votre inscription et accéder à l'espace patient,
            remplissez votre fiche patient — elle est <strong>obligatoire</strong>{" "}
            avant toute réservation.
          </span>
        </div>
        <p className="mx-auto mt-3 max-w-md text-center text-sm text-muted-foreground">
          Vous pourrez modifier certains éléments (téléphone, adresse…) à
          tout moment.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail *" className="sm:col-span-2">
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email")(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="pl-9"
                  required
                  readOnly={Boolean(accountEmail)}
                  disabled={Boolean(accountEmail)}
                />
              </div>
              {accountEmail ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Votre e-mail de connexion — il ne peut pas être modifié ici.
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Cet e-mail vous servira de contact et de compte de connexion
                  pour retrouver votre dossier à chaque visite.
                </p>
              )}
            </Field>
            <Field label="Nom *">
              <Input
                value={form.lastName}
                onChange={(e) => set("lastName")(e.target.value)}
                placeholder="Martin"
                required
              />
            </Field>
            <Field label="Prénom *">
              <Input
                value={form.firstName}
                onChange={(e) => set("firstName")(e.target.value)}
                placeholder="Léa"
                required
              />
            </Field>
            <Field label="Date de naissance *">
              <Input
                type="date"
                max={toDateKey(new Date())}
                value={form.birthDate}
                onChange={(e) => set("birthDate")(e.target.value)}
                required
              />
            </Field>
            <Field label="Téléphone *">
              <Input
                type="tel"
                value={form.phone}
                onChange={(e) => set("phone")(e.target.value)}
                placeholder="06 12 34 56 78"
                required
              />
            </Field>
            <Field label="Contact d'urgence — nom">
              <Input
                value={form.emergencyName}
                onChange={(e) => set("emergencyName")(e.target.value)}
                placeholder="Personne à prévenir"
              />
            </Field>
            <Field label="Contact d'urgence — téléphone">
              <Input
                type="tel"
                value={form.emergencyPhone}
                onChange={(e) => set("emergencyPhone")(e.target.value)}
                placeholder="06 98 76 54 32"
              />
            </Field>
            <Field label="Adresse *" className="sm:col-span-2">
              <Input
                value={form.address}
                onChange={(e) => set("address")(e.target.value)}
                placeholder="12 rue des Lilas"
                required
              />
            </Field>
            <Field label="Ville *">
              <Input
                value={form.city}
                onChange={(e) => set("city")(e.target.value)}
                placeholder="Paris"
                required
              />
            </Field>
            <Field label="Code postal">
              <Input
                value={form.postalCode}
                onChange={(e) => set("postalCode")(e.target.value)}
                placeholder="75011"
              />
            </Field>
            <Field label="Allergies" className="sm:col-span-2">
              <Textarea
                value={form.allergies}
                onChange={(e) => set("allergies")(e.target.value)}
                placeholder="Pénicilline, arachides… (séparées par des virgules)"
                rows={2}
                className="resize-none"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Votre équipe soignante les consulte avant chaque soin.
              </p>
            </Field>
            <Field label="Antécédents médicaux" className="sm:col-span-2">
              <Textarea
                value={form.antecedents}
                onChange={(e) => set("antecedents")(e.target.value)}
                placeholder="Diabète, hypertension, interventions… (séparés par des virgules)"
                rows={2}
                className="resize-none"
              />
            </Field>

            {/* Dossier enrichi */}
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 sm:col-span-2">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Droplets className="size-3.5 text-primary" />
                Dossier médical enrichi
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Ces informations aident l'équipe soignante à préparer vos
                consultations.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Groupe sanguin">
                  <Select
                    value={form.bloodGroup}
                    onValueChange={(v) => set("bloodGroup")(v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Non renseigné" />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOOD_GROUPS.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="hidden sm:block" />
                <Field label="Antécédents familiaux" className="sm:col-span-2">
                  <Textarea
                    value={form.familyHistory}
                    onChange={(e) => set("familyHistory")(e.target.value)}
                    placeholder="Diabète, hypertension, maladies cardiaques dans la famille… (séparés par des virgules)"
                    rows={2}
                    className="resize-none"
                  />
                </Field>
                <Field label="Antécédents chirurgicaux" className="sm:col-span-2">
                  <Textarea
                    value={form.surgicalHistory}
                    onChange={(e) => set("surgicalHistory")(e.target.value)}
                    placeholder="Opérations subies, hospitalisations… (séparés par des virgules)"
                    rows={2}
                    className="resize-none"
                  />
                </Field>
                <Field label="Traitements en cours" className="sm:col-span-2">
                  <Textarea
                    value={form.currentTreatments}
                    onChange={(e) => set("currentTreatments")(e.target.value)}
                    placeholder="Ex. Amlodipine 5 mg, matin — Metformine 500 mg, 2×/jour…"
                    rows={2}
                    className="resize-none"
                  />
                </Field>
              </div>
            </div>

            <Field label="Notes" className="sm:col-span-2">
              <Textarea
                value={form.notes}
                onChange={(e) => set("notes")(e.target.value)}
                placeholder="Particularités à connaître…"
                rows={3}
                className="resize-none"
              />
            </Field>

            {/* ---------- Insurance ---------- */}
            <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 sm:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <ShieldCheck className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Assurance
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ces informations nous permettront de préparer votre
                      règlement.
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Je suis assuré·e
                  </span>
                  <Switch
                    checked={form.insured}
                    onCheckedChange={toggle("insured")}
                    aria-label="Je suis assuré·e"
                  />
                </div>
              </div>

              {form.insured && (
                <div className="mt-4 grid gap-4 border-t border-border/70 pt-4 sm:grid-cols-2">
                  <Field label="Nom de l'assurance *" className="sm:col-span-2">
                    <Input
                      value={form.insuranceName}
                      onChange={(e) => set("insuranceName")(e.target.value)}
                      placeholder="Ex. Mutuelle Santé, Assurance Maladie…"
                      required
                    />
                  </Field>
                  <ToggleRow
                    label="Remboursé à 100 %"
                    hint="L'intégralité des frais est prise en charge"
                    checked={form.reimbursement100}
                    onChange={toggle("reimbursement100")}
                  />
                  <ToggleRow
                    label="Tiers payant"
                    hint="Vous n'avancez pas les frais à la clinique"
                    checked={form.tiersPayant}
                    onChange={toggle("tiersPayant")}
                  />
                  <Field label="Taux de remboursement (%)">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={form.reimbursementRate}
                      onChange={(e) =>
                        set("reimbursementRate")(e.target.value)
                      }
                      placeholder="Ex. 70"
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full rounded-full"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              "Créer ma fiche patient"
            )}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            Vos informations restent confidentielles et protégées.
          </p>
        </form>
      </Card>
    </main>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** Split a comma-separated input into a trimmed non-empty list. */
function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background px-3.5 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
