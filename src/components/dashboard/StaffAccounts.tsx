import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  KeyRound,
  Loader2,
  Lock,
  Power,
  ShieldCheck,
  Stethoscope,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ROLES = [
  { value: "admin", label: "Administrateur", icon: ShieldCheck },
  { value: "medecin", label: "Médecin", icon: Stethoscope },
  { value: "accueil", label: "Accueil", icon: UserCog },
] as const;

type RoleValue = (typeof ROLES)[number]["value"];

interface Member {
  _id: Id<"users">;
  name: string;
  email: string | null;
  staffRole: RoleValue | null;
  hasPassword: boolean;
  disabled: boolean;
}

export function StaffAccounts() {
  const members = useQuery(api.staff.listStaffMembers);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Member | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Chaque membre se connecte avec son nom ou son e-mail + son mot de
          passe individuel (onglet « Administration »).
        </p>
        <Button onClick={() => setCreateOpen(true)} className="shrink-0 rounded-full">
          <UserPlus className="size-4" />
          Ajouter un membre
        </Button>
      </div>

      {members === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl border border-border/70 bg-card"
            />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Users className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            Aucun compte individuel
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Créez les comptes de votre équipe (médecins, accueil) pour que
            chacun se connecte avec ses propres identifiants.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <MemberRow key={m._id} member={m} onReset={() => setResetTarget(m)} />
          ))}
        </div>
      )}

      <CreateMemberDialog open={createOpen} onOpenChange={setCreateOpen} />
      {resetTarget && (
        <ResetPasswordDialog
          member={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}

function MemberRow({
  member,
  onReset,
}: {
  member: Member;
  onReset: () => void;
}) {
  const updateStaffMember = useMutation(api.staff.updateStaffMember);
  const [busy, setBusy] = useState(false);

  const role =
    member.staffRole && ROLES.some((r) => r.value === member.staffRole)
      ? member.staffRole
      : "admin"; // legacy accounts keep admin rights
  const roleMeta = ROLES.find((r) => r.value === role)!;
  const RoleIcon = roleMeta.icon;

  const handleRoleChange = async (next: RoleValue) => {
    if (next === role) return;
    setBusy(true);
    try {
      await updateStaffMember({ memberId: member._id, role: next });
      toast.success(`Rôle de ${member.name} mis à jour.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Modification impossible.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async () => {
    setBusy(true);
    try {
      await updateStaffMember({
        memberId: member._id,
        disabled: !member.disabled,
      });
      toast.success(
        member.disabled
          ? `Compte de ${member.name} réactivé.`
          : `Compte de ${member.name} désactivé.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Modification impossible.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {member.name
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase()}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {member.name}
            </p>
            {member.disabled && (
              <Badge
                variant="outline"
                className="rounded-full border-rose-500/30 bg-rose-500/10 text-[10px] text-rose-600 dark:text-rose-400"
              >
                Désactivé
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {member.email ?? "Sans e-mail"}
            {member.hasPassword ? "" : " · compte partagé"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={role} onValueChange={(v) => handleRoleChange(v as RoleValue)}>
          <SelectTrigger
            size="sm"
            className="h-8 w-[150px] rounded-full border-border/70 text-xs"
            aria-label="Rôle du membre"
          >
            <SelectValue>
              <span className="flex items-center gap-1.5">
                <RoleIcon className="size-3.5" />
                {roleMeta.label}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => {
              const Icon = r.icon;
              return (
                <SelectItem key={r.value} value={r.value}>
                  <span className="flex items-center gap-1.5">
                    <Icon className="size-3.5" />
                    {r.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          className="h-8 rounded-full"
          title="Réinitialiser le mot de passe"
        >
          <KeyRound className="size-3.5" />
          Mot de passe
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          disabled={busy}
          className={cn(
            "size-8 rounded-full",
            member.disabled
              ? "text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
              : "text-muted-foreground hover:text-rose-600",
          )}
          title={member.disabled ? "Réactiver le compte" : "Désactiver le compte"}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Power className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function CreateMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createStaffMember = useMutation(api.staff.createStaffMember);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleValue>("medecin");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave =
    name.trim().length >= 2 && password.length >= 8 && !saving;

  const handleSubmit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await createStaffMember({
        name: name.trim(),
        email: email.trim() || undefined,
        role,
        password,
      });
      toast.success(`Compte de ${name.trim()} créé.`);
      setName("");
      setEmail("");
      setRole("medecin");
      setPassword("");
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter un membre de l'équipe</DialogTitle>
          <DialogDescription>
            Il se connectera à l'espace administration avec son nom ou son
            e-mail + le mot de passe choisi ici.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="member-name" className="text-xs font-medium text-muted-foreground">
              Nom complet
            </Label>
            <Input
              id="member-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr Aya Koné"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-email" className="text-xs font-medium text-muted-foreground">
              E-mail (optionnel)
            </Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aya.kone@clinique.ci"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Rôle
              </Label>
              <Select value={role} onValueChange={(v) => setRole(v as RoleValue)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-password" className="text-xs font-medium text-muted-foreground">
                Mot de passe
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="member-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8 caractères min."
                  minLength={8}
                />
              </div>
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
            disabled={!canSave}
            className="rounded-full"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UserPlus className="size-4" />
            )}
            Créer le compte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  member,
  onClose,
}: {
  member: Member;
  onClose: () => void;
}) {
  const resetStaffPassword = useMutation(api.staff.resetStaffPassword);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setSaving(true);
    try {
      await resetStaffPassword({ memberId: member._id, password });
      toast.success(`Mot de passe de ${member.name} réinitialisé.`);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Réinitialisation impossible.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          <DialogDescription>
            Nouveau mot de passe pour {member.name}. Il pourra se connecter
            avec son nom ou son e-mail + ce mot de passe.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reset-password" className="text-xs font-medium text-muted-foreground">
            Nouveau mot de passe
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caractères min."
              minLength={8}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-full">
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="rounded-full"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <KeyRound className="size-4" />
            )}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
