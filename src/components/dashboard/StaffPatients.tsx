import {
  InsuranceSummary,
  VisitCard,
  splitList,
} from "@/components/dashboard/MyRecord";
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
  BLOOD_GROUPS,
  computeAge,
  formatFullDate,
  initials,
  toDateKey,
} from "@/lib/clinic";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Activity,
  CalendarClock,
  Droplets,
  FilePlus2,
  FolderOpen,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Search,
  Stethoscope,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function StaffPatients() {
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] =
    useState<Id<"users"> | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const patients = useQuery(api.records.searchPatients, { query });
  const record = useQuery(
    api.records.getPatientRecord,
    selectedUserId ? { userId: selectedUserId } : "skip",
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      {/* ---------- Search + results ---------- */}
      <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedUserId(null);
            }}
            placeholder="Nom, prénom ou n° de dossier…"
            className="bg-background pl-9"
          />
        </div>

        {patients === undefined ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-10 text-center">
            <Users className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              Aucun patient trouvé
            </p>
            <p className="text-xs text-muted-foreground">
              {query
                ? "Essayez un autre nom ou numéro de dossier."
                : "Les fiches patient apparaîtront ici."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {patients.map((p) => {
              const selected = p.userId === selectedUserId;
              return (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => setSelectedUserId(p.userId)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-150",
                    selected
                      ? "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/20"
                      : "border-border/70 bg-card hover:border-primary/25 hover:shadow-soft",
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">
                    {initials(`${p.firstName} ${p.lastName}`)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {p.lastName.toUpperCase()} {p.firstName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      Dossier {p.dossierNumber} ·{" "}
                      {computeAge(p.birthDate) ?? "—"} ans · {p.city}
                    </span>
                    {p.email && (
                      <span className="block truncate text-[11px] text-muted-foreground/80">
                        {p.email}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- Record detail ---------- */}
      <div>
        {!selectedUserId ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <FolderOpen className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">
              Sélectionnez un patient
            </p>
            <p className="text-xs text-muted-foreground">
              Choisissez une fiche patient à gauche pour consulter son dossier
              médical.
            </p>
          </div>
        ) : record === undefined ? (
          <div className="space-y-3">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        ) : record === null ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
            <p className="text-sm font-semibold text-foreground">
              Ce patient n'a pas encore de fiche patient.
            </p>
          </div>
        ) : (
          <RecordPanel
            record={record}
            onAddVisit={() => setDialogOpen(true)}
          />
        )}
      </div>

      {selectedUserId && (
        <AddVisitDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          userId={selectedUserId}
        />
      )}
    </div>
  );
}

function RecordPanel({
  record,
  onAddVisit,
}: {
  record: {
    profile: {
      userId: Id<"users">;
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
    };
    visits: {
      _id: Id<"visits">;
      visitDate: string;
      report: string;
      diagnosis?: string;
      advice?: string;
      followUpDate?: string;
      medications: { name: string; dosage: string }[];
      exams: {
        name: string;
        status: "prescribed" | "done";
        comment?: string;
      }[];
      weight?: number;
      height?: number;
      bloodPressure?: string;
      temperature?: number;
      files: {
        _id: Id<"medicalFiles">;
        name: string;
        size?: number;
        mimeType?: string;
        url: string | null;
      }[];
      doctor: { name: string; title: string; color: string } | null;
    }[];
  };
  onAddVisit: () => void;
}) {
  const { profile, visits } = record;
  const age = computeAge(profile.birthDate);

  const generateUploadUrl = useMutation(api.records.generateUploadUrl);
  const attachVisitFile = useMutation(api.records.attachVisitFile);
  const deleteVisitFile = useMutation(api.records.deleteVisitFile);
  const [uploadingVisitId, setUploadingVisitId] =
    useState<Id<"visits"> | null>(null);
  const [medicalOpen, setMedicalOpen] = useState(false);

  const handleUpload = async (visitId: Id<"visits">, file: File) => {
    setUploadingVisitId(visitId);
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Envoi du fichier impossible.");
      const { storageId } = (await res.json()) as { storageId: string };
      await attachVisitFile({
        visitId,
        storageId,
        name: file.name,
        mimeType: file.type,
        size: file.size,
      });
      toast.success(`« ${file.name} » ajouté au dossier.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Envoi impossible.",
      );
    } finally {
      setUploadingVisitId(null);
    }
  };

  const handleDeleteFile = async (fileId: Id<"medicalFiles">) => {
    try {
      await deleteVisitFile({ fileId });
      toast.success("Document supprimé du dossier.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Suppression impossible.",
      );
    }
  };

  return (
    <div className="space-y-5">
      <Card className="border-border/70 p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                {profile.firstName} {profile.lastName.toUpperCase()}
              </h2>
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                Dossier {profile.dossierNumber}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Né·e le {formatFullDate(profile.birthDate)}
              {age !== null && (
                <span className="text-foreground"> · {age} ans</span>
              )}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {profile.email && (
                <>
                  <Mail className="mr-1 inline size-3.5 align-[-2px]" />
                  {profile.email}
                  <span className="mx-1.5">·</span>
                </>
              )}
              {profile.phone}
              {profile.emergencyPhone &&
                ` · Urgence : ${profile.emergencyPhone}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {profile.address}, {[profile.postalCode, profile.city].filter(Boolean).join(" ")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Assurance · Règlement
              </span>
              <InsuranceSummary profile={profile} />
            </div>

            {(profile.allergies?.length || profile.antecedents?.length) && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {profile.allergies && profile.allergies.length > 0 && (
                  <div className="rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
                      Allergies
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {profile.allergies.map((a, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.antecedents && profile.antecedents.length > 0 && (
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Antécédents médicaux
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {profile.antecedents.map((a, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-foreground"
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
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {profile.bloodGroup && (
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3">
                    <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
                      <Droplets className="size-3.5" />
                      Groupe sanguin
                    </p>
                    <p className="mt-1.5 text-sm font-bold text-foreground">
                      {profile.bloodGroup}
                    </p>
                  </div>
                )}
                {profile.familyHistory && profile.familyHistory.length > 0 && (
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Antécédents familiaux
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {profile.familyHistory.map((a, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-foreground"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.surgicalHistory && profile.surgicalHistory.length > 0 && (
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Antécédents chirurgicaux
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {profile.surgicalHistory.map((a, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px] font-medium text-foreground"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.currentTreatments && profile.currentTreatments.length > 0 && (
                  <div className="rounded-xl border border-teal-500/25 bg-teal-500/[0.06] p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      Traitements en cours
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {profile.currentTreatments.map((a, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-teal-500/10 px-2 py-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-300"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {profile.notes && (
              <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <span className="font-semibold">Notes : </span>
                {profile.notes}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Button onClick={onAddVisit} className="shrink-0 rounded-full">
              <FilePlus2 className="size-4" />
              Ajouter une visite
            </Button>
            <Button
              variant="outline"
              onClick={() => setMedicalOpen(true)}
              className="shrink-0 rounded-full"
            >
              <Pencil className="size-4" />
              Fiche médicale
            </Button>
          </div>
        </div>
      </Card>

      <div>
        <h3 className="text-sm font-bold tracking-tight text-foreground">
          Dossier médical
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {visits.length} compte{visits.length === 1 ? "" : "s"} rendu
            {visits.length === 1 ? "" : "s"}
          </span>
        </h3>
        <div className="mt-3 space-y-3">
          {visits.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
              <p className="text-sm font-semibold text-foreground">
                Aucun compte rendu
              </p>
              <p className="text-xs text-muted-foreground">
                Enregistrez la première visite de ce patient.
              </p>
            </div>
          ) : (
            visits.map((v) => (
              <VisitCard
                key={v._id}
                visit={v}
                patient={{
                  name: `${profile.firstName} ${profile.lastName}`,
                  dossierNumber: profile.dossierNumber,
                }}
                onUploadFile={(file) => handleUpload(v._id, file)}
                onDeleteFile={handleDeleteFile}
                uploading={uploadingVisitId === v._id}
              />
            ))
          )}
        </div>
      </div>

      <MedicalInfoDialog
        open={medicalOpen}
        onOpenChange={setMedicalOpen}
        userId={profile.userId}
        allergies={profile.allergies ?? []}
        antecedents={profile.antecedents ?? []}
        bloodGroup={profile.bloodGroup ?? ""}
        familyHistory={profile.familyHistory ?? []}
        surgicalHistory={profile.surgicalHistory ?? []}
        currentTreatments={profile.currentTreatments ?? []}
      />
    </div>
  );
}

/* ---------- Medical info dialog (allergies / antécédents) ---------- */

function MedicalInfoDialog({
  open,
  onOpenChange,
  userId,
  allergies,
  antecedents,
  bloodGroup,
  familyHistory,
  surgicalHistory,
  currentTreatments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
  allergies: string[];
  antecedents: string[];
  bloodGroup: string;
  familyHistory: string[];
  surgicalHistory: string[];
  currentTreatments: string[];
}) {
  const updateMedicalInfo = useMutation(api.records.updateMedicalInfo);
  const [allergiesText, setAllergiesText] = useState(allergies.join(", "));
  const [antecedentsText, setAntecedentsText] = useState(
    antecedents.join(", "),
  );
  const [bloodGroupValue, setBloodGroupValue] = useState(bloodGroup);
  const [familyHistoryText, setFamilyHistoryText] = useState(
    familyHistory.join(", "),
  );
  const [surgicalHistoryText, setSurgicalHistoryText] = useState(
    surgicalHistory.join(", "),
  );
  const [currentTreatmentsText, setCurrentTreatmentsText] = useState(
    currentTreatments.join(", "),
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMedicalInfo({
        userId,
        allergies: splitList(allergiesText),
        antecedents: splitList(antecedentsText),
        bloodGroup: bloodGroupValue.trim() || undefined,
        familyHistory: splitList(familyHistoryText),
        surgicalHistory: splitList(surgicalHistoryText),
        currentTreatments: splitList(currentTreatmentsText),
      });
      toast.success("Dossier médical mis à jour.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Mise à jour impossible.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fiche médicale du patient</DialogTitle>
          <DialogDescription>
            Informations médicales visibles par l'équipe soignante avant
            chaque soin.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Groupe sanguin
            </Label>
            <Select
              value={bloodGroupValue}
              onValueChange={setBloodGroupValue}
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
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Allergies
            </Label>
            <Textarea
              value={allergiesText}
              onChange={(e) => setAllergiesText(e.target.value)}
              placeholder="Pénicilline, arachides… (séparées par des virgules)"
              rows={2}
              className="resize-none"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Antécédents médicaux
            </Label>
            <Textarea
              value={antecedentsText}
              onChange={(e) => setAntecedentsText(e.target.value)}
              placeholder="Diabète, hypertension, interventions… (séparés par des virgules)"
              rows={3}
              className="resize-none"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Antécédents familiaux
            </Label>
            <Textarea
              value={familyHistoryText}
              onChange={(e) => setFamilyHistoryText(e.target.value)}
              placeholder="Maladies dans la famille… (séparées par des virgules)"
              rows={2}
              className="resize-none"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Antécédents chirurgicaux
            </Label>
            <Textarea
              value={surgicalHistoryText}
              onChange={(e) => setSurgicalHistoryText(e.target.value)}
              placeholder="Opérations, hospitalisations… (séparés par des virgules)"
              rows={2}
              className="resize-none"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Traitements en cours
            </Label>
            <Textarea
              value={currentTreatmentsText}
              onChange={(e) => setCurrentTreatmentsText(e.target.value)}
              placeholder="Ex. Amlodipine 5 mg, matin…"
              rows={2}
              className="resize-none"
            />
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
            onClick={handleSave}
            disabled={saving}
            className="rounded-full"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Add visit dialog ---------- */

interface MedRow {
  name: string;
  dosage: string;
}
interface ExamRow {
  name: string;
  status: "prescribed" | "done";
  comment: string;
}

function AddVisitDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: Id<"users">;
}) {
  const doctors = useQuery(api.catalog.listDoctors);
  const addVisit = useMutation(api.records.addVisit);

  const [visitDate, setVisitDate] = useState(toDateKey(new Date()));
  const [doctorId, setDoctorId] = useState<Id<"doctors"> | null>(null);
  const [report, setReport] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [advice, setAdvice] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [meds, setMeds] = useState<MedRow[]>([]);
  const [exams, setExams] = useState<ExamRow[]>([]);
  // Vital signs (optional)
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [bloodPressure, setBloodPressure] = useState("");
  const [temperature, setTemperature] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setVisitDate(toDateKey(new Date()));
    setDoctorId(null);
    setReport("");
    setDiagnosis("");
    setAdvice("");
    setFollowUpDate("");
    setMeds([]);
    setExams([]);
    setWeight("");
    setHeight("");
    setBloodPressure("");
    setTemperature("");
  };

  const handleSubmit = async () => {
    if (!doctorId || !report.trim()) {
      toast.error("Indiquez le médecin et le compte rendu.");
      return;
    }
    setSaving(true);
    try {
      await addVisit({
        userId,
        doctorId,
        visitDate,
        report,
        diagnosis: diagnosis.trim() || undefined,
        advice: advice.trim() || undefined,
        followUpDate: followUpDate || undefined,
        medications: meds,
        exams,
        weight: weight.trim() === "" ? undefined : Number(weight),
        height: height.trim() === "" ? undefined : Number(height),
        bloodPressure:
          bloodPressure.trim() === "" ? undefined : bloodPressure.trim(),
        temperature:
          temperature.trim() === "" ? undefined : Number(temperature),
      });
      toast.success("Compte rendu ajouté au dossier.");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nouvelle visite</DialogTitle>
          <DialogDescription>
            Compte rendu détaillé à ajouter au dossier médical du patient.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Date de la visite *
              </Label>
              <Input
                type="date"
                max={toDateKey(new Date())}
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Médecin *
              </Label>
              <Select
                value={doctorId ?? undefined}
                onValueChange={(v) => setDoctorId(v as Id<"doctors">)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir un médecin" />
                </SelectTrigger>
                <SelectContent>
                  {doctors?.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name} — {d.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Compte rendu *
            </Label>
            <Textarea
              value={report}
              onChange={(e) => setReport(e.target.value)}
              placeholder="Motif de la visite, examen clinique, observations, conclusion…"
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Diagnostic + suivi (dossier enrichi) */}
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
              <Stethoscope className="size-3.5" />
              Diagnostic & suivi
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Diagnostic retenu
                </Label>
                <Input
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Ex. Hypertension artérielle de grade 2"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Conseils / conduite à tenir
                </Label>
                <Input
                  value={advice}
                  onChange={(e) => setAdvice(e.target.value)}
                  placeholder="Ex. Régime pauvre en sel, exercice 30 min/jour…"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Prochaine consultation
                </Label>
                <Input
                  type="date"
                  min={toDateKey(new Date())}
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Vital signs */}
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Activity className="size-3.5 text-primary" />
              Signes vitaux (optionnel)
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Poids (kg)
                </Label>
                <Input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="68"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Taille (cm)
                </Label>
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="170"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Tension (TA)
                </Label>
                <Input
                  value={bloodPressure}
                  onChange={(e) => setBloodPressure(e.target.value)}
                  placeholder="12/8"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Température (°C)
                </Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="36,8"
                />
              </div>
            </div>
          </div>

          {/* Medications */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">
                Médicaments prescrits
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMeds((m) => [...m, { name: "", dosage: "" }])}
                className="h-7 gap-1 rounded-full text-xs text-primary"
              >
                <Plus className="size-3.5" />
                Ajouter
              </Button>
            </div>
            <div className="mt-2 space-y-2">
              {meds.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={m.name}
                    onChange={(e) =>
                      setMeds((all) =>
                        all.map((x, j) =>
                          j === i ? { ...x, name: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Médicament (ex. Paracétamol)"
                    className="flex-1"
                  />
                  <Input
                    value={m.dosage}
                    onChange={(e) =>
                      setMeds((all) =>
                        all.map((x, j) =>
                          j === i ? { ...x, dosage: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Posologie (ex. 1 g, 3×/jour)"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setMeds((all) => all.filter((_, j) => j !== i))
                    }
                    className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Exams */}
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground">
                Examens
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setExams((e) => [
                    ...e,
                    { name: "", status: "prescribed", comment: "" },
                  ])
                }
                className="h-7 gap-1 rounded-full text-xs text-primary"
              >
                <Plus className="size-3.5" />
                Ajouter
              </Button>
            </div>
            <div className="mt-2 space-y-2">
              {exams.map((e, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={e.name}
                    onChange={(ev) =>
                      setExams((all) =>
                        all.map((x, j) =>
                          j === i ? { ...x, name: ev.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Examen (ex. Bilan sanguin)"
                    className="flex-[2]"
                  />
                  <Select
                    value={e.status}
                    onValueChange={(v) =>
                      setExams((all) =>
                        all.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                status: v as "prescribed" | "done",
                              }
                            : x,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prescribed">À faire</SelectItem>
                      <SelectItem value="done">Fait</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={e.comment}
                    onChange={(ev) =>
                      setExams((all) =>
                        all.map((x, j) =>
                          j === i ? { ...x, comment: ev.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Résultat / commentaire"
                    className="flex-[2]"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setExams((all) => all.filter((_, j) => j !== i))
                    }
                    className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
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
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-full"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Enregistrer la visite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
