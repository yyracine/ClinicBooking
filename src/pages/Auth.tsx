import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.svg";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Home,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserCog,
  UserPlus,
  UserX,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

type Tab = "signIn" | "signUp" | "staff";
type Method = "password" | "otp";
type OtpStep = "email" | "code";

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const {
    isLoading: authLoading,
    isAuthenticated,
    user,
    signIn,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const mergeAnonymousAccount = useMutation(api.accounts.mergeAnonymousAccount);
  const myProfile = useQuery(api.records.myProfile);

  const [tab, setTab] = useState<Tab>("signIn");
  const [method, setMethod] = useState<Method>("otp");
  const [otpStep, setOtpStep] = useState<OtpStep>("email");
  const [otpEmail, setOtpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGuest =
    !authLoading && isAuthenticated && user?.isAnonymous === true;

  /** E-mail already recorded on the guest's fiche patient, used to prefill
      the upgrade form. Derived during render — no state sync in an effect. */
  const guestFicheEmail = isGuest
    ? (myProfile?.email ?? user?.email ?? "")
    : "";

  // Guests keep their anonymous session on this page so they can create an
  // account; every other signed-in visitor is redirected to their destination.
  useEffect(() => {
    if (!authLoading && isAuthenticated && !user?.isAnonymous) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, user?.isAnonymous, navigate, redirect]);

  const switchTab = (next: Tab) => {
    setTab(next);
    setError(null);
    setOtp("");
    setOtpStep("email");
  };

  const switchMethod = (next: Method) => {
    setMethod(next);
    setError(null);
    setOtp("");
    setOtpStep("email");
  };

  /** Move the guest's data onto the account they just signed in with, when the
      e-mails match. Never blocks the sign-in: a mismatch just keeps the data
      on the guest account. */
  const mergeGuestData = async (
    anonymousUserId: Id<"users"> | undefined,
  ) => {
    if (!anonymousUserId) return;
    try {
      await mergeAnonymousAccount({ anonymousUserId });
    } catch (mergeError) {
      console.error("Guest data merge error:", mergeError);
    }
  };

  const handlePasswordSignIn = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    const anonymousUserId = isGuest ? user?._id : undefined;
    try {
      const formData = new FormData(event.currentTarget);
      formData.set("flow", "signIn");
      await signIn("password", formData);
      await mergeGuestData(anonymousUserId);
      navigate(redirect);
    } catch (error) {
      console.error("Password sign-in error:", error);
      setError(
        "E-mail ou mot de passe incorrect. Vérifiez vos identifiants ou utilisez le code par e-mail.",
      );
      setIsLoading(false);
    }
  };

  const handlePasswordSignUp = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setIsLoading(true);
    try {
      formData.set("flow", "signUp");
      await signIn("password", formData);
      navigate(redirect);
    } catch (error) {
      console.error("Password sign-up error:", error);
      setError(
        "Impossible de créer ce compte. Cet e-mail est peut-être déjà utilisé — connectez-vous ou utilisez un code par e-mail.",
      );
      setIsLoading(false);
    }
  };

  /**
   * Staff sign in: either an individual account (identifier = name or e-mail
   * of the member) or the shared clinic password when left blank.
   */
  const handleStaffLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const identifier = String(formData.get("identifier") ?? "").trim();
      const password = String(formData.get("password") ?? "");
      await signIn(
        "staff",
        identifier ? { identifier, password } : { password },
      );
      navigate(redirect);
    } catch (error) {
      console.error("Staff sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Identifiant ou mot de passe incorrect.",
      );
      setIsLoading(false);
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setOtpEmail(formData.get("email") as string);
      setOtpStep("code");
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "L'envoi du code a échoué. Veuillez réessayer.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    const anonymousUserId = isGuest ? user?._id : undefined;
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      await mergeGuestData(anonymousUserId);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("Le code de vérification saisi est incorrect.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        `Échec de la connexion invitée : ${
          error instanceof Error ? error.message : "erreur inconnue"
        }`,
      );
      setIsLoading(false);
    }
  };

  /**
   * A guest (anonymous) visitor creates their full account. Signing up with
   * email + password creates a new Convex Auth account; we then move the
   * guest's fiche patient, appointments and medical file onto it.
   */
  const handleGuestUpgrade = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (!email) {
      setError("Veuillez saisir votre adresse e-mail.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    const recordEmail = myProfile?.email ?? user?.email ?? "";
    if (
      recordEmail &&
      email.toLocaleLowerCase("fr") !== recordEmail.toLocaleLowerCase("fr")
    ) {
      setError(
        `Pour retrouver votre fiche patient, utilisez l'e-mail : ${recordEmail}`,
      );
      return;
    }

    setIsLoading(true);
    try {
      const anonymousUserId = user?._id;
      const signUpData = new FormData();
      signUpData.set("flow", "signUp");
      signUpData.set("email", email);
      signUpData.set("password", password);
      await signIn("password", signUpData);

      if (anonymousUserId) {
        try {
          await mergeAnonymousAccount({ anonymousUserId });
        } catch (mergeError) {
          console.error("Guest upgrade merge error:", mergeError);
          toast.error(
            "Votre compte est créé, mais le rattachement de votre fiche patient a échoué.",
          );
        }
      }
      toast.success("Compte créé — votre espace patient est prêt !");
      navigate(redirect);
    } catch (error) {
      console.error("Guest upgrade error:", error);
      setError(
        "Impossible de créer ce compte. Cet e-mail est peut-être déjà utilisé — connectez-vous ou utilisez un code par e-mail.",
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Theme toggle */}
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      {/* Back to the home page */}
      <div className="absolute left-4 top-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate("/")}
          className="rounded-full text-muted-foreground hover:text-foreground"
        >
          <Home className="size-4" />
          <span className="hidden sm:inline">Retour à l'accueil</span>
        </Button>
      </div>

      {/* Brand */}
      <div className="mb-7 flex flex-col items-center">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-85"
        >
          <img
            src={logo}
            alt="Clinic Bookings"
            width={42}
            height={42}
            className="rounded-[12px]"
          />
          <span className="text-lg font-bold tracking-tight text-foreground">
            Clinic Bookings
          </span>
        </button>
      </div>

      <Card className="w-full max-w-[420px] border-border/70 shadow-lifted">
        {/* Mode tabs — always visible, "Se connecter" by default, even for
            guests. Guests create their account from the "Créer un compte" tab. */}
        <div className="grid grid-cols-3 gap-1 rounded-full bg-muted/70 p-1 mx-6 mt-6">
          <button
            type="button"
            onClick={() => switchTab("signIn")}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-sm font-medium transition-all duration-150",
              tab === "signIn"
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <KeyRound className="size-3.5 shrink-0" />
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => switchTab("signUp")}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-sm font-medium transition-all duration-150",
              tab === "signUp"
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <UserPlus className="size-3.5 shrink-0" />
            Créer un compte
          </button>
          <button
            type="button"
            onClick={() => switchTab("staff")}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-2 text-sm font-medium transition-all duration-150",
              tab === "staff"
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ShieldCheck className="size-3.5 shrink-0" />
            Administration
          </button>
        </div>

        {tab === "signIn" && (
          <p className="mx-6 mt-3 text-center text-[11px] leading-4 text-muted-foreground">
            Compte de démonstration :{" "}
            <span className="font-medium text-foreground">
              demo@clinic-bookings.local
            </span>{" "}
            · mot de passe{" "}
            <span className="font-medium text-foreground">
              demo1234
            </span>
          </p>
        )}

        {tab === "signIn" && isGuest && myProfile && (
          <div className="mx-6 mt-3 flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2.5 text-[11px] leading-4 text-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>
              Vous êtes en session invité avec une fiche patient enregistrée.{" "}
              <button
                type="button"
                onClick={() => switchTab("signUp")}
                className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
              >
                Créez votre compte
              </button>{" "}
              pour la conserver — ou connectez-vous avec l'e-mail de votre
              fiche pour la rattacher automatiquement.
            </span>
          </div>
        )}

        {tab === "signUp" ? (
          isGuest ? (
            /* ---------- Guest upgrade: create your account ---------- */
            <>
              <CardHeader className="text-center pt-6">
                <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
                  <ShieldCheck className="size-6 text-primary" />
                </span>
                <CardTitle className="text-xl tracking-tight">
                  Créez votre compte
                </CardTitle>
                <CardDescription>
                  Vous êtes actuellement en session invité. En créant votre
                  compte, votre fiche patient, vos rendez-vous et votre dossier
                  médical resteront associés à ce profil.
                </CardDescription>
                <p className="mx-auto max-w-xs rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-4 text-foreground">
                  Votre compte ne sera finalisé qu'après la création de votre
                  fiche patient, obligatoire pour prendre rendez-vous.
                </p>
              </CardHeader>
              <form onSubmit={handleGuestUpgrade}>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      name="email"
                      type="email"
                      value={upgradeEmail || guestFicheEmail}
                      onChange={(e) => setUpgradeEmail(e.target.value)}
                      placeholder="nom@exemple.com"
                      className="pl-9"
                      disabled={isLoading}
                      required
                      autoComplete="email"
                    />
                  </div>
                  {myProfile?.email && (
                    <p className="text-[11px] leading-4 text-muted-foreground">
                      Utilisez l'e-mail de votre fiche patient (
                      {myProfile.email}) pour la retrouver automatiquement.
                    </p>
                  )}
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      name="password"
                      placeholder="Mot de passe (8 caractères min.)"
                      type={showPassword ? "text" : "password"}
                      className="pl-9 pr-10"
                      disabled={isLoading}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={
                        showPassword
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      name="confirm"
                      placeholder="Confirmer le mot de passe"
                      type={showPassword ? "text" : "password"}
                      className="pl-9"
                      disabled={isLoading}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <Button
                    type="submit"
                    className="w-full rounded-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Création du compte…
                      </>
                    ) : (
                      <>
                        Créer mon compte
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <p className="flex items-center justify-center gap-1.5 text-center text-[11px] leading-4 text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-primary" />
                    Cet e-mail et ce mot de passe vous permettront de vous
                    connecter à votre espace patient.
                  </p>
                </CardContent>
              </form>
              <div className="px-6 pb-5">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate(redirect)}
                  disabled={isLoading}
                  className="w-full rounded-full text-muted-foreground hover:text-foreground"
                >
                  Plus tard — continuer en tant qu'invité
                </Button>
              </div>
            </>
          ) : (
            /* ---------- Create account ---------- */
            <>
              <CardHeader className="text-center pt-5">
                <CardTitle className="text-xl tracking-tight">
                  Créer votre compte
                </CardTitle>
                <CardDescription>
                  Un e-mail et un mot de passe pour retrouver votre dossier à
                  chaque visite.
                </CardDescription>
                <p className="mx-auto max-w-xs rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] leading-4 text-foreground">
                  Votre compte ne sera finalisé qu'après la création de votre
                  fiche patient, obligatoire pour prendre rendez-vous.
                </p>
                <p className="mx-auto max-w-xs text-[11px] leading-4 text-muted-foreground">
                  L'e-mail de démonstration{" "}
                  <span className="font-medium text-foreground">
                    demo@clinic-bookings.local
                  </span>{" "}
                  existe déjà : connectez-vous avec, ou choisissez votre
                  propre e-mail ici.
                </p>
              </CardHeader>
              <form onSubmit={handlePasswordSignUp}>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      name="email"
                      placeholder="nom@exemple.com"
                      type="email"
                      className="pl-9"
                      disabled={isLoading}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      name="password"
                      placeholder="Mot de passe (8 caractères min.)"
                      type={showPassword ? "text" : "password"}
                      className="pl-9 pr-10"
                      disabled={isLoading}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={
                        showPassword
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      name="confirm"
                      placeholder="Confirmer le mot de passe"
                      type={showPassword ? "text" : "password"}
                      className="pl-9"
                      disabled={isLoading}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-500">{error}</p>
                  )}
                  <Button
                    type="submit"
                    className="w-full rounded-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Création du compte…
                      </>
                    ) : (
                      <>
                        Créer mon compte
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <p className="text-center text-[11px] leading-4 text-muted-foreground">
                    Cette adresse e-mail et ce mot de passe vous permettront de
                    vous connecter à votre espace patient.
                  </p>
                </CardContent>
              </form>
            </>
          )
        ) : tab === "staff" ? (
          /* ---------- Staff password login ---------- */
          <>
            <CardHeader className="text-center pt-5">
              <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-2xl bg-primary/10">
                <ShieldCheck className="size-5 text-primary" />
              </span>
              <CardTitle className="text-xl tracking-tight">
                Espace administration
              </CardTitle>
              <CardDescription>
                Accès réservé à l'équipe de la clinique. Connectez-vous avec
                votre nom ou votre e-mail + votre mot de passe individuel, ou
                avec le mot de passe partagé.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleStaffLogin}>
              <CardContent className="space-y-3">
                <div className="relative">
                  <UserCog className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    name="identifier"
                    placeholder="Nom ou e-mail du compte (optionnel)"
                    className="pl-9"
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    name="password"
                    placeholder="Mot de passe"
                    type={showPassword ? "text" : "password"}
                    className="pl-9 pr-10"
                    disabled={isLoading}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button
                  type="submit"
                  className="w-full rounded-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Accéder au planning
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                <p className="text-center text-[11px] leading-4 text-muted-foreground">
                  Compte de test : mot de passe partagé « admin123 » (à
                  modifier depuis l'espace administration). Les membres créés
                  dans « Équipe » utilisent leur nom ou e-mail.
                </p>
              </CardContent>
            </form>
          </>
        ) : method === "otp" ? (
          /* ---------- Sign in with email code (OTP) ---------- */
          otpStep === "email" ? (
            <>
              <CardHeader className="text-center pt-5">
                <CardTitle className="text-xl tracking-tight">
                  Se connecter par e-mail
                </CardTitle>
                <CardDescription>
                  Entrez votre e-mail : nous vous envoyons un code de
                  connexion.
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleEmailSubmit}>
                <CardContent className="space-y-3">
                  <MethodToggle method={method} onChange={switchMethod} />
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      name="email"
                      placeholder="nom@exemple.com"
                      type="email"
                      className="pl-9"
                      disabled={isLoading}
                      required
                      autoComplete="email"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-500">{error}</p>
                  )}
                  <Button
                    type="submit"
                    className="w-full rounded-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Recevoir le code
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </form>
            </>
          ) : (
            <>
              <CardHeader className="text-center pt-5">
                <CardTitle className="text-xl tracking-tight">
                  Vérifiez votre e-mail
                </CardTitle>
                <CardDescription>
                  Nous avons envoyé un code à {otpEmail}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleOtpSubmit}>
                <CardContent className="pb-4">
                  <div className="mb-3">
                    <MethodToggle method={method} onChange={switchMethod} />
                  </div>
                  <input type="hidden" name="email" value={otpEmail} />
                  <input type="hidden" name="code" value={otp} />

                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          otp.length === 6 &&
                          !isLoading
                        ) {
                          const form = (
                            e.target as HTMLElement
                          ).closest("form");
                          if (form) {
                            form.requestSubmit();
                          }
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && (
                    <p className="mt-2 text-center text-sm text-red-500">
                      {error}
                    </p>
                  )}
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    Vous n'avez rien reçu ?{" "}
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => setOtpStep("email")}
                    >
                      Renvoyer le code
                    </Button>
                  </p>
                </CardContent>
                <CardFooter className="flex-col gap-2">
                  <Button
                    type="submit"
                    className="w-full rounded-full"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Vérification…
                      </>
                    ) : (
                      <>
                        Vérifier le code
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOtpStep("email")}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Utiliser un autre e-mail
                  </Button>
                </CardFooter>
              </form>
            </>
          )
        ) : (
          /* ---------- Sign in with password ---------- */
          <>
            <CardHeader className="text-center pt-5">
              <CardTitle className="text-xl tracking-tight">
                Accéder à votre espace
              </CardTitle>
              <CardDescription>
                Connectez-vous avec l'e-mail et le mot de passe de votre
                compte.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handlePasswordSignIn}>
              <CardContent className="space-y-3">
                <MethodToggle method={method} onChange={switchMethod} />
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    name="email"
                    placeholder="nom@exemple.com"
                    type="email"
                    className="pl-9"
                    disabled={isLoading}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    name="password"
                    placeholder="Mot de passe"
                    type={showPassword ? "text" : "password"}
                    className="pl-9 pr-10"
                    disabled={isLoading}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button
                  type="submit"
                  className="w-full rounded-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Se connecter
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardContent>
            </form>
          </>
        )}

        {/* Staff shortcut — visible on every patient mode so the clinic team
            never has to hunt for their login. */}
        {tab !== "staff" && (
          <div className="px-6 pt-4">
            <button
              type="button"
              onClick={() => switchTab("staff")}
              className="flex w-full items-center justify-center gap-1.5 rounded-full border border-border/70 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
            >
              <ShieldCheck className="size-3.5" />
              Administration de la clinique — connexion par mot de passe
            </button>
          </div>
        )}

        {/* Guest access — hidden on the staff tab: the clinic team signs in
            exclusively with the shared password. */}
        {!isGuest && tab !== "staff" && (
          <div className="px-6 pb-5">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/70" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Ou</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full rounded-full"
              onClick={handleGuestLogin}
              disabled={isLoading}
            >
              <UserX className="mr-2 h-4 w-4" />
              Continuer en tant qu'invité
            </Button>
            <p className="mt-2.5 text-center text-[11px] leading-4 text-muted-foreground">
              Accès rapide sans créer de compte. Vous pourrez créer votre compte
              à tout moment.
            </p>
          </div>
        )}

        <div className="rounded-b-lg border-t bg-muted/60 px-6 py-4 text-center text-xs text-muted-foreground">
          Sécurisé par{" "}
          <a
            href="https://freebuff.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-primary transition-colors"
          >
            freebuff.com
          </a>
        </div>
      </Card>
    </div>
  );
}

function MethodToggle({
  method,
  onChange,
}: {
  method: Method;
  onChange: (method: Method) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-full bg-muted/70 p-1">
      <button
        type="button"
        onClick={() => onChange("otp")}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150",
          method === "otp"
            ? "bg-card text-foreground shadow-soft"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Mail className="size-3" />
        Code par e-mail
      </button>
      <button
        type="button"
        onClick={() => onChange("password")}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150",
          method === "password"
            ? "bg-card text-foreground shadow-soft"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <KeyRound className="size-3" />
        Mot de passe
      </button>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
