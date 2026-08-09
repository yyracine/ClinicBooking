import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarPlus, Loader2, LockKeyhole, Stethoscope } from "lucide-react";
import { useState } from "react";

export function RoleGate({
  onChoose,
}: {
  onChoose: (role: "patient") => void;
}) {
  const [pending, setPending] = useState(false);

  const choose = async () => {
    setPending(true);
    await onChoose("patient");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border/70 p-6 shadow-lifted sm:p-8">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Stethoscope className="size-7 text-primary" />
        </div>
        <h1 className="text-center text-xl font-bold tracking-tight text-foreground">
          Bienvenue sur Clinic Bookings
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-center text-sm text-muted-foreground">
          Vous accédez à l'espace patient : choisissez un service, un
          praticien et un créneau, puis suivez vos rendez-vous et votre
          dossier médical.
        </p>

        <Button
          type="button"
          onClick={choose}
          disabled={pending}
          className="mt-6 flex h-auto w-full items-start justify-start gap-3 rounded-2xl p-5 text-left whitespace-normal"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {pending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <CalendarPlus className="size-5" />
            )}
          </span>
          <span>
            <span className="block text-sm font-semibold">
              Je prends rendez-vous
            </span>
            <span className="mt-1 block text-xs leading-5 text-primary-foreground/80">
              Continuer en tant que patient et ouvrir ma fiche patient.
            </span>
          </span>
        </Button>

        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-border/70 bg-muted/40 px-4 py-3">
          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs leading-5 text-muted-foreground">
            L'équipe de la clinique se connecte avec le mot de passe dédié,
            depuis la rubrique « Espace administration » de la page de
            connexion.
          </p>
        </div>
      </Card>
    </main>
  );
}
