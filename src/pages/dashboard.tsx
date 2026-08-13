import { BookAppointment } from "@/components/dashboard/BookAppointment";
import { MyAppointments } from "@/components/dashboard/MyAppointments";
import { MyRecord } from "@/components/dashboard/MyRecord";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { ConnectionDot } from "@/components/connection-status";
import { PatientProfileForm } from "@/components/dashboard/PatientProfileForm";
import { RoleGate } from "@/components/dashboard/RoleGate";
import { StaffAccounts } from "@/components/dashboard/StaffAccounts";
import { StaffActivityLog } from "@/components/dashboard/StaffActivityLog";
import { StaffDoctors } from "@/components/dashboard/StaffDoctors";
import { StaffPatients } from "@/components/dashboard/StaffPatients";
import { StaffPlanning } from "@/components/dashboard/StaffPlanning";
import { StaffStats } from "@/components/dashboard/StaffStats";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useInactivityLogout } from "@/hooks/use-inactivity-logout";
import { initials } from "@/lib/clinic";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import logo from "@/assets/logo.svg";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  BarChart3,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  FileHeart,
  History,
  KeyRound,
  Loader2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ShieldCheck,
  Stethoscope,
  UserCog,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

type ViewKey =
  | "book"
  | "mine"
  | "record"
  | "staff"
  | "patients"
  | "doctors"
  | "stats"
  | "log"
  | "team";

const VIEW_META: Record<ViewKey, { title: string; description: string }> = {
  book: {
    title: "Prendre rendez-vous",
    description:
      "Choisissez un service, un praticien et un créneau. C'est prêt en deux minutes.",
  },
  mine: {
    title: "Mes rendez-vous",
    description: "Retrouvez vos consultations à venir et passées.",
  },
  record: {
    title: "Mon dossier médical",
    description:
      "Votre fiche patient, vos comptes rendus de consultation et vos examens.",
  },
  staff: {
    title: "Planning de la clinique",
    description:
      "Tous les rendez-vous en tableau ou en calendrier semaine/mois, avec les congés des praticiens.",
  },
  patients: {
    title: "Patients",
    description:
      "Recherchez une fiche patient et consultez les dossiers médicaux.",
  },
  doctors: {
    title: "Médecins",
    description:
      "Les fiches des praticiens : spécialité, téléphone et jours et heures de vacation.",
  },
  stats: {
    title: "Statistiques",
    description:
      "Chiffre d'affaires, volume de rendez-vous et activité des praticiens.",
  },
  log: {
    title: "Journal d'activité",
    description:
      "La piste d'audit de la clinique : réservations, paiements, annulations et gestion de l'équipe.",
  },
  team: {
    title: "Équipe",
    description:
      "Les comptes de l'équipe : rôles, activation et mots de passe individuels.",
  },
};

export default function Dashboard() {
  const { user, isLoading, signOut } = useAuth();
  useInactivityLogout();
  const navigate = useNavigate();
  const [view, setView] = useState<ViewKey>("book");
  const [passwordOpen, setPasswordOpen] = useState(false);
  // Desktop sidebar open/close — frees up space for the content.
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const seedDemo = useAction(api.seedDemo.seedDemoData);
  const setRole = useMutation(api.appointments.setRole);
  const claimProfileByEmail = useMutation(api.records.claimProfileByEmail);
  const myProfile = useQuery(api.records.myProfile);
  // Ref guards the auto-claim so it only runs once per mount without
  // triggering extra renders.
  const claimStarted = useRef(false);
  const [claimDone, setClaimDone] = useState(false);

  useEffect(() => {
    // Idempotent: seeds services, doctors & demo patients on first run.
    void seedDemo();
  }, [seedDemo]);

  // A patient may have a fiche patient under another account with the same
  // e-mail (e.g. created with a password, then signed in with a code). Claim
  // it once so they never fill the form twice.
  useEffect(() => {
    if (
      user &&
      user.role === "patient" &&
      user.email &&
      myProfile === null &&
      !claimStarted.current
    ) {
      claimStarted.current = true;
      claimProfileByEmail()
        .catch((error) => {
          console.error("Claim profile by email failed:", error);
        })
        .finally(() => setClaimDone(true));
    }
  }, [user, myProfile, claimProfileByEmail]);

  // Keep the fiche form hidden while the auto-claim is running, so a patient
  // who already has a fiche (under another account with the same e-mail)
  // never sees it flashed in front of them.
  const claimPending =
    user?.role === "patient" && myProfile === null && !claimDone;

  // Staff accounts have no patient views (booking lives in the patient
  // space — the team books on behalf of patients from the planning): land
  // directly on the planning instead of the booking screen.
  useEffect(() => {
    if (user?.role === "staff" && (view === "book" || view === "mine")) {
      setView("staff");
    }
  }, [user?.role, view]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleRoleChoose = async (role: "patient" | "staff") => {
    try {
      await setRole({ role });
      toast.success(
        role === "staff"
          ? "Mode administration activé — bienvenue dans le planning."
          : "Bienvenue ! Vous pouvez réserver votre premier rendez-vous.",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Une erreur est survenue.",
      );
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!user) return null;

  // First connection: choose between patient and clinic staff.
  if (user.role == null) {
    return <RoleGate onChoose={handleRoleChoose} />;
  }

  // Every patient must fill in their record card (fiche patient) to get
  // access to their medical file.
  if (user.role === "patient" && (myProfile === undefined || claimPending)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }
  if (user.role === "patient" && myProfile === null) {
    return <PatientProfileForm onDone={() => setView("book")} />;
  }

  const isStaff = user.role === "staff";
  const isAdmin =
    isStaff && (user.staffRole == null || user.staffRole === "admin");
  const displayName = user.name ?? "Invité";
  const displayEmail = user.email ?? undefined;

  const navItems: {
    key: ViewKey;
    label: string;
    icon: typeof CalendarPlus;
  }[] = [
    // Booking and "Mes rendez-vous" are patient-only: the clinic team books
    // on behalf of patients from the planning ("Nouveau RDV").
    ...(!isStaff
      ? [
          {
            key: "book" as const,
            label: "Prendre rendez-vous",
            icon: CalendarPlus,
          },
          {
            key: "mine" as const,
            label: "Mes rendez-vous",
            icon: CalendarDays,
          },
        ]
      : []),
    ...(!isStaff
      ? [{ key: "record" as const, label: "Mon dossier", icon: FileHeart }]
      : []),
    ...(isStaff
      ? [{ key: "staff" as const, label: "Planning", icon: ClipboardList }]
      : []),
    ...(isStaff
      ? [{ key: "patients" as const, label: "Patients", icon: Users }]
      : []),
    ...(isStaff
      ? [{ key: "doctors" as const, label: "Médecins", icon: Stethoscope }]
      : []),
    ...(isStaff
      ? [{ key: "stats" as const, label: "Statistiques", icon: BarChart3 }]
      : []),
    ...(isStaff
      ? [{ key: "log" as const, label: "Journal", icon: History }]
      : []),
    ...(isAdmin
      ? [{ key: "team" as const, label: "Équipe", icon: UserCog }]
      : []),
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* ---------- Sidebar (desktop) ---------- */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border/70 bg-sidebar transition-[width] duration-300 ease-in-out lg:flex",
          sidebarOpen ? "w-[264px]" : "w-0 border-r-0",
        )}
      >
        <button
          type="button"
          onClick={() => navigate("/")}
          title="Retour à l'accueil"
          className="flex items-center gap-2.5 px-5 pb-5 pt-6 text-left transition-opacity hover:opacity-80"
        >
          <img
            src={logo}
            alt="Clinic Bookings"
            width={36}
            height={36}
            className="rounded-[10px]"
          />
          <div className="leading-tight">
            <p className="text-sm font-bold text-foreground">
              Clinic Bookings
            </p>
            <p className="text-[11px] text-muted-foreground">
              Espace en ligne
            </p>
          </div>
        </button>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              Préférences
            </span>
            <div className="flex items-center gap-1.5">
              <ConnectionDot className="ml-0.5" />
              <NotificationBell className="size-8" />
              <ThemeToggle className="size-8" />
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl p-2">
            <Avatar className="size-9 shrink-0 rounded-full">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                {initials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold text-foreground">
                {displayName}
              </p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                {isStaff ? (
                  <ShieldCheck className="size-3 shrink-0 text-primary" />
                ) : (
                  <UserRound className="size-3 shrink-0" />
                )}
                {isStaff ? "Administration" : "Patient"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              title="Se déconnecter"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ---------- Main column ---------- */}
      <div className="min-w-0 flex-1">
        {/* Desktop top bar — open/close the sidebar to free up space */}
        <div className="sticky top-0 z-30 hidden items-center justify-between border-b border-border/70 bg-background/85 px-4 py-2.5 backdrop-blur lg:flex">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen((v) => !v)}
            className="h-8 gap-1.5 rounded-full text-xs font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
            title={
              sidebarOpen
                ? "Masquer le menu latéral"
                : "Afficher le menu latéral"
            }
          >
            {sidebarOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
            {sidebarOpen ? "Masquer le menu" : "Afficher le menu"}
          </Button>
          <ConnectionDot />
        </div>

        {/* Mobile header */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => navigate("/")}
            title="Retour à l'accueil"
            className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-80"
          >
            <img
              src={logo}
              alt="Clinic Bookings"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-sm font-bold text-foreground">
              Clinic Bookings
            </span>
          </button>            <div className="flex items-center gap-2">
            <ConnectionDot />
            <NotificationBell />
            <ThemeToggle />
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="size-9 cursor-pointer rounded-full">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {initials(displayName)}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="truncate text-sm font-semibold">{displayName}</p>
                {displayEmail && (
                  <p className="truncate text-xs font-normal text-muted-foreground">
                    {displayEmail}
                  </p>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 size-4" />
                Se déconnecter
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Mobile nav pills */}
        <div className="flex gap-1 overflow-x-auto px-4 pt-4 lg:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setView(item.key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
                  active
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border/70 bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-5xl space-y-6">
            {/* Guest banner */}
            {user?.isAnonymous && (
              <div className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <UserRound className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Espace invité
                    </p>
                    <p className="mt-0.5 max-w-md text-xs leading-5 text-muted-foreground">
                      Créez votre compte pour conserver votre fiche patient et
                      vos rendez-vous sur tous vos appareils.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate("/auth")}
                  size="sm"
                  className="shrink-0 rounded-full"
                >
                  <UserPlus className="size-4" />
                  Créer mon compte
                </Button>
              </div>
            )}

            {/* Page header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Stethoscope className="size-3.5 text-primary" />
                  {isStaff ? "Espace administration" : "Espace patient"}
                </p>
                <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {VIEW_META[view].title}
                </h1>
                <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                  {VIEW_META[view].description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isStaff && (
                  <Button
                    variant="outline"
                    onClick={() => setPasswordOpen(true)}
                    className="rounded-full"
                    title="Changer le mot de passe de l'administration"
                  >
                    <KeyRound className="size-4" />
                    Mot de passe
                  </Button>
                )}
                {view === "mine" && (
                  <Button
                    onClick={() => setView("book")}
                    className="shrink-0 rounded-full"
                  >
                    <Plus className="size-4" />
                    Nouveau rendez-vous
                  </Button>
                )}
              </div>
            </div>

            {view === "book" && !isStaff && (
              <BookAppointment onGoToMine={() => setView("mine")} />
            )}
            {view === "mine" && !isStaff && (
              <MyAppointments onBook={() => setView("book")} />
            )}
            {view === "record" && !isStaff && <MyRecord />}
            {view === "staff" && isStaff && <StaffPlanning />}
            {view === "patients" && isStaff && <StaffPatients />}
            {view === "doctors" && isStaff && <StaffDoctors />}
            {view === "stats" && isStaff && <StaffStats />}
            {view === "log" && isStaff && <StaffActivityLog />}
            {view === "team" && isAdmin && <StaffAccounts />}
          </div>
        </main>
      </div>

      {/* Staff password dialog */}
      <StaffPasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
      />
    </div>
  );
}

function StaffPasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateStaffPassword = useMutation(api.settings.updateStaffPassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (next.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (next !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateStaffPassword({ currentPassword: current, newPassword: next });
      toast.success("Mot de passe de l'administration mis à jour.");
      setCurrent("");
      setNext("");
      setConfirm("");
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de modifier le mot de passe.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mot de passe de l'administration</DialogTitle>
          <DialogDescription>
            Le mot de passe partagé permet à l'équipe de se connecter à
            l'espace administration. Modifiez-le dès la fin de la période de
            test.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="staff-current" className="text-xs font-medium text-muted-foreground">
              Mot de passe actuel
            </Label>
            <Input
              id="staff-current"
              type={showPassword ? "text" : "password"}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="Mot de passe actuel"
              required
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-next" className="text-xs font-medium text-muted-foreground">
              Nouveau mot de passe
            </Label>
            <Input
              id="staff-next"
              type={showPassword ? "text" : "password"}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="8 caractères minimum"
              minLength={8}
              required
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-confirm" className="text-xs font-medium text-muted-foreground">
              Confirmer le nouveau mot de passe
            </Label>
            <Input
              id="staff-confirm"
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmer"
              required
              disabled={saving}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            Afficher les mots de passe
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full"
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving} className="rounded-full">
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

