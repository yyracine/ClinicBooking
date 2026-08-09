import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { History } from "lucide-react";

/**
 * Journal d'activité (piste d'audit) : les dernières actions de la clinique
 * (réservations, paiements, annulations, gestion de l'équipe…) avec l'auteur,
 * une étiquette lisible et le détail.
 */

/** Readable label per action key (fallback: the raw key). */
const ACTION_LABELS: Record<string, string> = {
  "appointment.booked": "Réservation en ligne",
  "appointment.booked-by-staff": "Créé par l'administration",
  "appointment.cancelled": "Annulation",
  "appointment.status": "Changement de statut",
  "payment.recorded": "Paiement validé",
  "waiting.join": "Liste d'attente",
  "waiting.leave": "Liste d'attente",
  "waiting.assign": "Créneau attribué",
  "staff.created": "Équipe",
  "staff.updated": "Équipe",
  "staff.password-reset": "Équipe",
};

function actionBadge(action: string): { label: string; tone: string } {
  if (action.startsWith("payment")) {
    return { label: "Paiement", tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" };
  }
  if (action.startsWith("appointment.cancelled")) {
    return { label: "Annulation", tone: "text-rose-600 dark:text-rose-400 bg-rose-500/10" };
  }
  if (action.startsWith("staff")) {
    return { label: "Équipe", tone: "text-violet-600 dark:text-violet-400 bg-violet-500/10" };
  }
  if (action.startsWith("waiting")) {
    return { label: "Attente", tone: "text-amber-600 dark:text-amber-400 bg-amber-500/10" };
  }
  return { label: "Rendez-vous", tone: "text-teal-600 dark:text-teal-400 bg-teal-500/10" };
}

export function StaffActivityLog() {
  const entries = useQuery(api.log.listActivityLogs);

  if (entries === undefined) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl border border-border/70 bg-card"
          />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <History className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">
          Aucune activité enregistrée
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Les actions importantes (réservations, paiements, annulations,
          gestion de l'équipe) apparaîtront ici.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft">
      <ul className="divide-y divide-border/60">
        {entries.map((e) => {
          const badge = actionBadge(e.action);
          const date = new Date(e.createdAt);
          return (
            <li
              key={e._id}
              className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40"
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase tracking-wide",
                  badge.tone,
                )}
              >
                {badge.label.slice(0, 3)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {e.label}
                  </p>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {date.toLocaleString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {e.details && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {e.details}
                  </p>
                )}
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                  Par : {e.actor ?? "Système"}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
