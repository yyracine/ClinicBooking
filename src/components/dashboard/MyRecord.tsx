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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import {
  BLOOD_GROUPS,
  computeAge,
  doctorTint,
  formatFullDate,
  formatShortDate,
  formatVitalSigns,
  initials,
  type VisitWithDoctor,
} from "@/lib/clinic";
import { jsPDF } from "jspdf";
import { useMutation, useQuery } from "convex/react";
import {
  Activity,
  Download,
  Droplets,
  FileHeart,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Paperclip,
  Pencil,
  Phone,
  ShieldCheck,
  ShieldX,
  Siren,
  Stethoscope,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { ToggleRow } from "./PatientProfileForm";

interface ProfileLike {
  dossierNumber: string;
  email?: string;
  lastName: string;
  firstName: string;
  birthDate: string;
  phone: string;
  emergencyName?: string;
  emergencyPhone?: string;
  address: string;
  city: string;
  postalCode?: string;
  notes?: string;
  allergies?: string[];
  antecedents?: string[];
  bloodGroup?: string;
  familyHistory?: string[];
  surgicalHistory?: string[];
  currentTreatments?: string[];
  insured: boolean;
  insuranceName?: string;
  reimbursement100?: boolean;
  tiersPayant?: boolean;
  reimbursementRate?: number;
}

interface EditableFields {
  phone: string;
  emergencyName: string;
  emergencyPhone: string;
  address: string;
  city: string;
  postalCode: string;
  notes: string;
  allergies: string;
  antecedents: string;
  bloodGroup: string;
  familyHistory: string;
  surgicalHistory: string;
  currentTreatments: string;
  insured: boolean;
  insuranceName: string;
  reimbursement100: boolean;
  tiersPayant: boolean;
  reimbursementRate: string;
}

function editableFrom(profile: ProfileLike): EditableFields {
  return {
    phone: profile.phone,
    emergencyName: profile.emergencyName ?? "",
    emergencyPhone: profile.emergencyPhone ?? "",
    address: profile.address,
    city: profile.city,
    postalCode: profile.postalCode ?? "",
    notes: profile.notes ?? "",
    allergies: (profile.allergies ?? []).join(", "),
    antecedents: (profile.antecedents ?? []).join(", "),
    bloodGroup: profile.bloodGroup ?? "",
    familyHistory: (profile.familyHistory ?? []).join(", "),
    surgicalHistory: (profile.surgicalHistory ?? []).join(", "),
    currentTreatments: (profile.currentTreatments ?? []).join(", "),
    insured: profile.insured,
    insuranceName: profile.insuranceName ?? "",
    reimbursement100: profile.reimbursement100 ?? false,
    tiersPayant: profile.tiersPayant ?? false,
    reimbursementRate:
      profile.reimbursementRate != null
        ? String(profile.reimbursementRate)
        : "",
  };
}

export function MyRecord() {
  const profile = useQuery(api.records.myProfile);
  const visits = useQuery(api.records.myVisits);
  const updateProfile = useMutation(api.records.updateProfile);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditableFields | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    if (!profile) return;
    setForm(editableFrom(profile));
    setEditing(true);
  };

  const handleSave = async () => {
    if (!form) return;
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
      await updateProfile({
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
      toast.success("Fiche patient mise à jour.");
      setEditing(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Mise à jour impossible.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (!profile) return;
    downloadDossier(profile, visits ?? []);
  };

  if (!profile) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const age = computeAge(profile.birthDate);

  return (
    <div className="space-y-5">
      {/* ---------- Record card ---------- */}
      <Card className="border-border/70 shadow-soft">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <span
              className={cn(
                "flex size-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold",
                doctorTint("teal"),
              )}
            >
              {initials(`${profile.firstName} ${profile.lastName}`)}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  {profile.firstName} {profile.lastName}
                </h2>
                <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  Dossier {profile.dossierNumber}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <FileHeart className="size-3.5 text-primary" />
                Né·e le {formatFullDate(profile.birthDate)}
                {age !== null && (
                  <span className="text-foreground">· {age} ans</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <Button
              variant="outline"
              onClick={handleDownload}
              className="rounded-full"
            >
              <Download className="size-4" />
              Télécharger mon dossier
            </Button>
            <Button
              variant="ghost"
              onClick={startEdit}
              className="rounded-full text-muted-foreground hover:text-foreground"
            >
              <Pencil className="size-4" />
              Modifier ma fiche
            </Button>
          </div>
        </div>

        {editing && form ? (
          <div className="border-t border-border/70 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <EditField label="Téléphone">
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  required
                />
              </EditField>
              <EditField label="Contact d'urgence — nom">
                <Input
                  value={form.emergencyName}
                  onChange={(e) =>
                    setForm({ ...form, emergencyName: e.target.value })
                  }
                />
              </EditField>
              <EditField label="Contact d'urgence — téléphone">
                <Input
                  value={form.emergencyPhone}
                  onChange={(e) =>
                    setForm({ ...form, emergencyPhone: e.target.value })
                  }
                />
              </EditField>
              <EditField label="Code postal">
                <Input
                  value={form.postalCode}
                  onChange={(e) =>
                    setForm({ ...form, postalCode: e.target.value })
                  }
                />
              </EditField>
              <EditField label="Adresse" className="sm:col-span-2">
                <Input
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                  required
                />
              </EditField>
              <EditField label="Ville" className="sm:col-span-2">
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  required
                />
              </EditField>
              <EditField label="Allergies" className="sm:col-span-2">
                <Textarea
                  value={form.allergies}
                  onChange={(e) =>
                    setForm({ ...form, allergies: e.target.value })
                  }
                  placeholder="Pénicilline, arachides… (séparées par des virgules)"
                  rows={2}
                  className="resize-none"
                />
              </EditField>
              <EditField label="Antécédents médicaux" className="sm:col-span-2">
                <Textarea
                  value={form.antecedents}
                  onChange={(e) =>
                    setForm({ ...form, antecedents: e.target.value })
                  }
                  placeholder="Diabète, hypertension… (séparés par des virgules)"
                  rows={2}
                  className="resize-none"
                />
              </EditField>

              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 sm:col-span-2">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <Droplets className="size-3.5 text-primary" />
                  Dossier médical enrichi
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <EditField label="Groupe sanguin">
                    <Select
                      value={form.bloodGroup}
                      onValueChange={(v) =>
                        setForm({ ...form, bloodGroup: v })
                      }
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
                  </EditField>
                  <EditField label="Antécédents familiaux" className="sm:col-span-2">
                    <Textarea
                      value={form.familyHistory}
                      onChange={(e) =>
                        setForm({ ...form, familyHistory: e.target.value })
                      }
                      placeholder="Maladies dans la famille… (séparées par des virgules)"
                      rows={2}
                      className="resize-none"
                    />
                  </EditField>
                  <EditField label="Antécédents chirurgicaux" className="sm:col-span-2">
                    <Textarea
                      value={form.surgicalHistory}
                      onChange={(e) =>
                        setForm({ ...form, surgicalHistory: e.target.value })
                      }
                      placeholder="Opérations, hospitalisations… (séparés par des virgules)"
                      rows={2}
                      className="resize-none"
                    />
                  </EditField>
                  <EditField label="Traitements en cours" className="sm:col-span-2">
                    <Textarea
                      value={form.currentTreatments}
                      onChange={(e) =>
                        setForm({ ...form, currentTreatments: e.target.value })
                      }
                      placeholder="Ex. Amlodipine 5 mg, matin…"
                      rows={2}
                      className="resize-none"
                    />
                  </EditField>
                </div>
              </div>

              <EditField label="Notes" className="sm:col-span-2">
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="resize-none"
                />
              </EditField>

              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Assurance
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Utilisées pour préparer votre règlement.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Je suis assuré·e
                    </span>
                    <Switch
                      checked={form.insured}
                      onCheckedChange={(c) =>
                        setForm({ ...form, insured: c })
                      }
                      aria-label="Je suis assuré·e"
                    />
                  </div>
                </div>
                {form.insured && (
                  <div className="mt-4 grid gap-4 border-t border-border/70 pt-4 sm:grid-cols-2">
                    <EditField
                      label="Nom de l'assurance"
                      className="sm:col-span-2"
                    >
                      <Input
                        value={form.insuranceName}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            insuranceName: e.target.value,
                          })
                        }
                      />
                    </EditField>
                    <ToggleRow
                      label="Remboursé à 100 %"
                      hint="L'intégralité des frais est prise en charge"
                      checked={form.reimbursement100}
                      onChange={(c) =>
                        setForm({ ...form, reimbursement100: c })
                      }
                    />
                    <ToggleRow
                      label="Tiers payant"
                      hint="Vous n'avancez pas les frais à la clinique"
                      checked={form.tiersPayant}
                      onChange={(c) =>
                        setForm({ ...form, tiersPayant: c })
                      }
                    />
                    <EditField label="Taux de remboursement (%)">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={form.reimbursementRate}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            reimbursementRate: e.target.value,
                          })
                        }
                      />
                    </EditField>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="rounded-full">
                {saving && <Loader2 className="size-4 animate-spin" />}
                Enregistrer
              </Button>
              <Button
                variant="ghost"
                onClick={() => setEditing(false)}
                className="rounded-full text-muted-foreground"
              >
                <X className="size-4" />
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <>
            {(profile.allergies?.length || profile.antecedents?.length) && (
              <div className="grid gap-4 border-t border-border/70 p-5 sm:grid-cols-2 sm:p-6">
                {profile.allergies && profile.allergies.length > 0 && (
                  <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                      <Siren className="size-3.5" />
                      Allergies
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.allergies.map((a, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.antecedents && profile.antecedents.length > 0 && (
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Antécédents médicaux
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.antecedents.map((a, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-border/70 bg-background px-2.5 py-0.5 text-xs font-medium text-foreground"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {(profile.bloodGroup ||
              profile.familyHistory?.length ||
              profile.surgicalHistory?.length ||
              profile.currentTreatments?.length) && (
              <div className="grid gap-4 border-t border-border/70 p-5 sm:grid-cols-2 sm:p-6">
                {profile.bloodGroup && (
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                      <Droplets className="size-3.5" />
                      Groupe sanguin
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-foreground">
                      {profile.bloodGroup}
                    </p>
                  </div>
                )}
                {profile.familyHistory && profile.familyHistory.length > 0 && (
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Antécédents familiaux
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.familyHistory.map((a, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-border/70 bg-background px-2.5 py-0.5 text-xs font-medium text-foreground"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.surgicalHistory && profile.surgicalHistory.length > 0 && (
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Antécédents chirurgicaux
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.surgicalHistory.map((a, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-border/70 bg-background px-2.5 py-0.5 text-xs font-medium text-foreground"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.currentTreatments && profile.currentTreatments.length > 0 && (
                  <div className="rounded-xl border border-teal-500/25 bg-teal-500/[0.06] p-3.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      Traitements en cours
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {profile.currentTreatments.map((a, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-teal-500/10 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="grid gap-x-6 gap-y-4 border-t border-border/70 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
              {profile.email && (
                <InfoRow
                  icon={<Mail className="size-4" />}
                  label="E-mail"
                  value={profile.email}
                />
              )}
              <InfoRow icon={<Phone className="size-4" />} label="Téléphone" value={profile.phone} />
              <InfoRow
                icon={<Siren className="size-4" />}
                label="Contact d'urgence"
                value={[profile.emergencyName, profile.emergencyPhone]
                  .filter(Boolean)
                  .join(" — ") || "Non renseigné"}
              />
              <InfoRow
                icon={<MapPin className="size-4" />}
                label="Adresse"
                value={[profile.address, [profile.postalCode, profile.city].filter(Boolean).join(" ")]
                  .filter(Boolean)
                  .join(", ")}
              />
              <InfoRow
                icon={<ShieldCheck className="size-4" />}
                label="Assurance"
                className="sm:col-span-2 lg:col-span-1"
              >
                <InsuranceSummary profile={profile} />
              </InfoRow>
              {profile.notes && (
                <InfoRow
                  icon={<FileHeart className="size-4" />}
                  label="Notes"
                  value={profile.notes}
                  className="sm:col-span-2 lg:col-span-3"
                />
              )}
            </div>
          </>
        )}
      </Card>

      {/* ---------- Visits ---------- */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold tracking-tight text-foreground">
          Dossier médical
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {visits?.length ?? 0} compte{visits?.length === 1 ? "" : "s"} rendu
            {visits?.length === 1 ? "" : "s"}
          </span>
        </h3>
      </div>

      {/* ---------- Vital signs evolution (P7) ---------- */}
      <VitalsChart visits={visits ?? []} />

      {visits === undefined ? (
        <div className="space-y-3">
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      ) : visits.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Stethoscope className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            Aucun compte rendu pour le moment
          </p>
          <p className="text-xs text-muted-foreground">
            Les comptes rendus de vos consultations apparaîtront ici, remplis
            par votre médecin.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visits.map((visit) => (
            <VisitCard
              key={visit._id}
              visit={visit}
              patient={{
                name: `${profile.firstName} ${profile.lastName}`,
                dossierNumber: profile.dossierNumber,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Vital signs evolution chart (P7) ---------- */

const VITAL_METRICS = [
  { key: "weight", label: "Poids (kg)", color: "#0d9488" },
  { key: "temperature", label: "Température (°C)", color: "#f59e0b" },
  { key: "sys", label: "Tension systolique", color: "#8b5cf6" },
  { key: "dia", label: "Tension diastolique", color: "#06b6d4" },
] as const;

type VitalMetricKey = (typeof VITAL_METRICS)[number]["key"];

/**
 * Évolution des signes vitaux au fil des visites (poids, température,
 * tension artérielle). Masqué tant qu'il n'y a pas au moins 2 mesures d'une
 * même constante.
 */
function VitalsChart({ visits }: { visits: VisitWithDoctor[] }) {
  const data = useMemo(
    () =>
      visits
        .filter(
          (v) =>
            v.weight != null ||
            v.temperature != null ||
            Boolean(v.bloodPressure),
        )
        .map((v) => {
          const [sys, dia] = (v.bloodPressure ?? "")
            .split(/[/\s]/)
            .map(Number);
          return {
            label: formatShortDate(v.visitDate),
            weight: v.weight ?? null,
            temperature: v.temperature ?? null,
            sys: Number.isFinite(sys) ? sys : null,
            dia: Number.isFinite(dia) ? dia : null,
          };
        }),
    [visits],
  );

  const [active, setActive] = useState<VitalMetricKey>("weight");
  const metric = VITAL_METRICS.find((m) => m.key === active) ?? VITAL_METRICS[0];
  const points = data.filter((d) => d[active] != null);

  if (data.length < 2 || points.length < 2) return null;

  const unit =
    active === "weight" ? "kg" : active === "temperature" ? "°C" : "mmHg";

  return (
    <Card className="border-border/70 p-5 shadow-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-foreground">
            Évolution des signes vitaux
          </h3>
          <p className="text-xs text-muted-foreground">
            Mesurés lors de vos consultations
          </p>
        </div>
        <div className="flex w-fit items-center gap-1 rounded-full border border-border/70 bg-muted/50 p-1">
          {VITAL_METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setActive(m.key)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                active === m.key
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#64748b" }}
              tickLine={false}
              axisLine={false}
              unit={active === "weight" ? "" : ""}
            />
            <Tooltip
              formatter={(value: number) => [
                `${String(value).replace(".", ",")} ${unit}`,
                metric.label,
              ]}
            />
            <Line
              type="monotone"
              dataKey={active}
              name={metric.label}
              stroke={metric.color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: metric.color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function InfoRow({
  icon,
  label,
  value,
  className,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </p>
      {children ?? (
        <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
      )}
    </div>
  );
}

/** Compact insurance summary, shared by the patient record and staff views. */
export function InsuranceSummary({
  profile,
}: {
  profile: {
    insured: boolean;
    insuranceName?: string;
    reimbursement100?: boolean;
    tiersPayant?: boolean;
    reimbursementRate?: number;
  };
}) {
  if (!profile.insured) {
    return (
      <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <ShieldX className="size-4 text-muted-foreground" />
        Non assuré·e
      </span>
    );
  }
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
        <ShieldCheck className="size-4 text-primary" />
        {profile.insuranceName || "Assuré·e"}
      </span>
      {profile.reimbursement100 && (
        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-400/10 dark:text-teal-300">
          Remboursé à 100 %
        </span>
      )}
      {profile.tiersPayant && (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          Tiers payant
        </span>
      )}
      {profile.reimbursementRate != null && (
        <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          Taux : {profile.reimbursementRate} %
        </span>
      )}
    </div>
  );
}

function EditField({
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
export function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Human-friendly file size, ex. "1,2 Mo". */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/**
 * One consultation report card of the medical file. Shared by the patient
 * view and the staff "Patients" view (which can upload attachments).
 */
export function VisitCard({
  visit,
  patient,
  onUploadFile,
  onDeleteFile,
  uploading,
}: {
  visit: VisitWithDoctor;
  patient?: { name: string; dossierNumber: string };
  onUploadFile?: (file: File) => void;
  onDeleteFile?: (fileId: Id<"medicalFiles">) => void;
  uploading?: boolean;
}) {
  const vitalSigns = formatVitalSigns(visit);
  return (
    <Card className="border-border/70 p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-foreground">
          Visite du {formatFullDate(visit.visitDate)}
        </p>
        {visit.doctor && (
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-[10px] font-bold",
                doctorTint(visit.doctor.color),
              )}
            >
              {initials(visit.doctor.name)}
            </span>
            {visit.doctor.name} · {visit.doctor.title}
          </span>
        )}
      </div>

      {vitalSigns && (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/25 bg-teal-500/[0.07] px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-300">
            <Activity className="size-3.5" />
            {vitalSigns}
          </span>
        </div>
      )}

      {visit.diagnosis && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.05] px-3.5 py-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            Diagnostic
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">
            {visit.diagnosis}
          </p>
        </div>
      )}

      {visit.report && (
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-foreground/90">
          {visit.report}
        </p>
      )}

      {(visit.advice || visit.followUpDate) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {visit.advice && (
            <p className="rounded-lg border border-border/70 bg-muted/30 px-3 py-1.5 text-xs leading-5 text-foreground">
              <span className="font-bold">Conseils : </span>
              {visit.advice}
            </p>
          )}
          {visit.followUpDate && (
            <p className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/25 bg-teal-500/[0.07] px-3 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300">
              <Stethoscope className="size-3.5" />
              Prochaine consultation : {formatShortDate(visit.followUpDate)}
            </p>
          )}
        </div>
      )}

      {visit.medications.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Médicaments prescrits
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {visit.medications.map((m, i) => (
              <span
                key={i}
                className="rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground"
              >
                <span className="font-semibold">{m.name}</span>
                {m.dosage && (
                  <span className="text-muted-foreground"> · {m.dosage}</span>
                )}
              </span>
            ))}
          </div>
          {patient && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadPrescription(visit, patient)}
              className="mt-3 gap-1.5 rounded-full text-xs"
            >
              <FileText className="size-3.5" />
              Télécharger l'ordonnance
            </Button>
          )}
        </div>
      )}

      {visit.exams.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Examens
          </p>
          <ul className="mt-2 space-y-1.5">
            {visit.exams.map((e, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2 text-sm">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    e.status === "done"
                      ? "bg-teal-100 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
                  )}
                >
                  {e.status === "done" ? "Fait" : "À faire"}
                </span>
                <span className="font-medium text-foreground">{e.name}</span>
                {e.comment && (
                  <span className="text-muted-foreground">— {e.comment}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(visit.files.length > 0 || onUploadFile) && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Pièces jointes
            </p>
            {onUploadFile && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-primary/30 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
                <Upload className="size-3.5" />
                {uploading ? "Envoi…" : "Ajouter un document"}
                <input
                  type="file"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) onUploadFile(file);
                  }}
                />
              </label>
            )}
          </div>
          <ul className="mt-2 space-y-1.5">
            {visit.files.map((f) => (
              <li
                key={f._id}
                className="flex items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
              >
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {f.name}
                </span>
                {f.size != null && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatFileSize(f.size)}
                  </span>
                )}
                {f.url ? (
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <Download className="size-3" />
                    Ouvrir
                  </a>
                ) : (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    indisponible
                  </span>
                )}
                {onDeleteFile && (
                  <button
                    type="button"
                    onClick={() => onDeleteFile(f._id)}
                    className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="Supprimer ce document"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** Normalize text for the PDF's WinAnsi encoding (French accents are fine). */
function pdfSafe(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ");
}

/** Build and download a formatted A4 prescription (ordonnance). */
function downloadPrescription(
  visit: VisitWithDoctor,
  patient: { name: string; dossierNumber: string },
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const PAGE_W = 210;
  const MARGIN = 18;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const ACCENT: [number, number, number] = [13, 148, 136];
  const DARK: [number, number, number] = [30, 41, 59];
  const MUTED: [number, number, number] = [100, 116, 139];
  let y = 48;

  /* ---------- Header ---------- */
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(0, 0, PAGE_W, 24, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("CLINIC BOOKINGS", MARGIN, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Ordonnance médicale", PAGE_W - MARGIN, 12, { align: "right" });

  /* ---------- Patient + prescriber ---------- */
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    pdfSafe(`Patient : ${patient.name} — Dossier ${patient.dossierNumber}`),
    MARGIN,
    34,
  );
  doc.text(
    pdfSafe(
      `Prescrite le ${formatFullDate(visit.visitDate)}${
        visit.doctor
          ? ` — ${visit.doctor.name}${
              visit.doctor.title ? ` (${visit.doctor.title})` : ""
            }`
          : ""
      }`,
    ),
    MARGIN,
    39,
  );

  /* ---------- Medicines ---------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  doc.text("À délivrer au patient", MARGIN, y);
  y += 6;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(DARK[0], DARK[1], DARK[2]);
  for (const m of visit.medications) {
    const lines = doc.splitTextToSize(
      pdfSafe(`• ${m.name}${m.dosage ? ` — ${m.dosage}` : ""}`),
      CONTENT_W,
    ) as string[];
    for (const line of lines) {
      doc.text(line, MARGIN + 2, y);
      y += 6;
    }
    y += 3;
  }

  /* ---------- Footer ---------- */
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(
    "Document confidentiel — Clinic Bookings",
    MARGIN,
    285,
  );
  doc.save(`ordonnance-${patient.dossierNumber}.pdf`);
}

/** Build and download a formatted A4 PDF of the medical dossier. */
function downloadDossier(profile: ProfileLike, visits: VisitWithDoctor[]) {
  const age = computeAge(profile.birthDate);
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN = 18;
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const BOTTOM = PAGE_H - 22;
  let y = 0;

  const ACCENT: [number, number, number] = [13, 148, 136];
  const DARK: [number, number, number] = [30, 41, 59];
  const MUTED: [number, number, number] = [100, 116, 139];

  /** Advance to a fresh page if the given height doesn't fit. */
  const ensure = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const text = (
    str: string,
    opts: { x?: number; size?: number; bold?: boolean; color?: [number, number, number]; indent?: number } = {},
  ) => {
    const { x = MARGIN, size = 10, bold = false, color = DARK, indent = 0 } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(pdfSafe(str), x + indent, y);
  };

  const wrapped = (
    str: string,
    opts: { size?: number; color?: [number, number, number]; lineHeight?: number } = {},
  ) => {
    const { size = 9.5, color = DARK, lineHeight = 4.6 } = opts;
    const lines = doc.splitTextToSize(pdfSafe(str), CONTENT_W) as string[];
    for (const line of lines) {
      ensure(lineHeight);
      text(line, { size, color });
      y += lineHeight;
    }
  };

  const divider = (color: [number, number, number] = [226, 232, 240]) => {
    ensure(6);
    y += 3;
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 5;
  };

  /* ---------- Header ---------- */
  doc.setFillColor(ACCENT[0], ACCENT[1], ACCENT[2]);
  doc.rect(0, 0, PAGE_W, 34, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text("CLINIC BOOKINGS", MARGIN, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(pdfSafe("Dossier médical"), MARGIN, 25);
  doc.setFont("helvetica", "bold");
  doc.text(pdfSafe(`Dossier ${profile.dossierNumber}`), PAGE_W - MARGIN, 16, {
    align: "right",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Document confidentiel", PAGE_W - MARGIN, 25, { align: "right" });

  y = 46;

  /* ---------- Patient identity ---------- */
  text("FICHE PATIENT", { size: 11, bold: true, color: ACCENT });
  y += 7;
  const fullName = `${profile.lastName.toUpperCase()} ${profile.firstName}`;
  text(fullName, { size: 15, bold: true });
  y += 9;

  const info: [string, string][] = [
    ["Numéro de dossier", profile.dossierNumber],
    ["Né·e le", `${formatFullDate(profile.birthDate)}${age !== null ? ` (${age} ans)` : ""}`],
    ["E-mail", profile.email ?? "—"],
    ["Téléphone", profile.phone],
    ...(profile.emergencyName || profile.emergencyPhone
      ? [
          [
            "Contact d'urgence",
            [profile.emergencyName, profile.emergencyPhone]
              .filter(Boolean)
              .join(" — "),
          ] as [string, string],
        ]
      : []),
    [
      "Adresse",
      [
        profile.address,
        [profile.postalCode, profile.city].filter(Boolean).join(" "),
      ]
        .filter(Boolean)
        .join(", "),
    ],
  ];

  // Two-column label/value grid: label above its value, in two columns.
  const colW = CONTENT_W / 2;
  for (let i = 0; i < info.length; i += 2) {
    const left = info[i];
    const right = info[i + 1];
    ensure(12);
    const rowY = y;
    for (const [idx, item] of [left, right].entries()) {
      if (!item) continue;
      const x = MARGIN + (idx % 2) * colW;
      text(item[0], { size: 8, bold: true, color: MUTED, x });
      y = rowY + 4.5;
      text(item[1], { size: 9.5, x });
      y = rowY;
    }
    y = rowY + 12;
  }

  const insuranceLabel = profile.insured
    ? profile.insuranceName || "Assuré·e"
    : "Non assuré·e";
  ensure(12);
  text("ASSURANCE", { size: 8, bold: true, color: MUTED });
  y += 4.5;
  text(insuranceLabel, { size: 9.5, bold: profile.insured });
  y += 5;
  if (profile.insured) {
    const cover: string[] = [];
    if (profile.reimbursement100) cover.push("Remboursement à 100 %");
    if (profile.tiersPayant) cover.push("Tiers payant");
    if (profile.reimbursementRate != null)
      cover.push(`Taux de ${profile.reimbursementRate} %`);
    if (cover.length > 0) {
      text(cover.join(" · "), { size: 9, color: MUTED });
      y += 5;
    }
  }
  if ((profile.allergies ?? []).length > 0) {
    text("ALLERGIES", { size: 8, bold: true, color: MUTED });
    y += 5;
    wrapped((profile.allergies ?? []).join(" · "), { size: 9.5 });
    y += 2;
  }
  if ((profile.antecedents ?? []).length > 0) {
    text("ANTÉCÉDENTS MÉDICAUX", { size: 8, bold: true, color: MUTED });
    y += 5;
    wrapped((profile.antecedents ?? []).join(" · "), { size: 9.5 });
    y += 2;
  }
  if (profile.notes) {
    text("NOTES", { size: 8, bold: true, color: MUTED });
    y += 5;
    wrapped(profile.notes, { size: 9.5 });
  }

  divider();

  /* ---------- Consultations ---------- */
  text("COMPTES RENDUS DE CONSULTATION", { size: 11, bold: true, color: ACCENT });
  y += 7;

  if (visits.length === 0) {
    ensure(14);
    text("Aucun compte rendu pour le moment.", { size: 10, color: MUTED });
  }

  for (const v of visits) {
    ensure(18);
    y += 2;
    text(formatFullDate(v.visitDate), { size: 10.5, bold: true });
    y += 5;
    text(
      v.doctor
        ? `${v.doctor.name}${v.doctor.title ? ` — ${v.doctor.title}` : ""}`
        : "Médecin",
      { size: 9, color: ACCENT },
    );
    y += 5;

    const vital = formatVitalSigns(v);
    if (vital) {
      text(vital, { size: 9, color: MUTED });
      y += 5;
    }

    if (v.report) {
      wrapped(v.report, { size: 9.5, lineHeight: 4.8 });
    }

    if (v.medications.length > 0) {
      ensure(12);
      y += 3;
      text("Médicaments prescrits", { size: 9, bold: true, color: MUTED });
      y += 5;
      for (const m of v.medications) {
        ensure(6);
        text(`• ${m.name}${m.dosage ? ` — ${m.dosage}` : ""}`, {
          size: 9,
          indent: 2,
        });
        y += 5;
      }
    }

    if (v.exams.length > 0) {
      ensure(12);
      y += 3;
      text("Examens", { size: 9, bold: true, color: MUTED });
      y += 5;
      for (const e of v.exams) {
        ensure(6);
        const status = e.status === "done" ? "[Fait]" : "[À faire]";
        text(
          `${status} ${e.name}${e.comment ? ` — ${e.comment}` : ""}`,
          { size: 9, indent: 2 },
        );
        y += 5;
      }
    }

    if (v.files.length > 0) {
      ensure(10);
      y += 3;
      text("Pièces jointes", { size: 9, bold: true, color: MUTED });
      y += 5;
      for (const f of v.files) {
        ensure(6);
        text(`• ${f.name}`, { size: 9, indent: 2 });
        y += 5;
      }
    }

    divider();
  }

  /* ---------- Footer (page numbers) ---------- */
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      pdfSafe(
        `Clinic Bookings — Dossier ${profile.dossierNumber} — page ${i}/${pages}`,
      ),
      MARGIN,
      PAGE_H - 12,
    );
  }

  doc.save(`dossier-${profile.dossierNumber}.pdf`);
}
