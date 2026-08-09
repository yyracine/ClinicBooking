import { RefreshCw, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useConnection,
  type ConnectionStatus,
} from "@/hooks/use-connection";

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  online: "Connecté",
  reconnecting: "Reconnexion en cours…",
  offline: "Hors ligne",
};

/** Small colored dot shown in the app header (green / amber / red). */
export function ConnectionDot({ className }: { className?: string }) {
  const status = useConnection();
  return (
    <span
      role="status"
      aria-label={`Connexion : ${STATUS_LABELS[status]}`}
      title={`Connexion : ${STATUS_LABELS[status]}`}
      className={cn("relative flex size-2.5 shrink-0", className)}
    >
      {status === "reconnecting" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
      )}
      <span
        className={cn(
          "relative inline-flex size-2.5 rounded-full transition-colors duration-300",
          status === "online" && "bg-emerald-500",
          status === "reconnecting" && "bg-amber-500",
          status === "offline" && "bg-rose-500",
        )}
      />
    </span>
  );
}

/**
 * Floating banner shown while the connection is lost or reconnecting.
 * Rendered app-wide (main.tsx) so it appears on every page, whatever the
 * navigation state. Disappears automatically when the connection is back.
 */
export function ConnectionBanner() {
  const status = useConnection();
  if (status === "online") return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-3">
      <div
        role="status"
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-500/40 bg-background/95 px-4 py-2 text-xs font-medium text-amber-700 shadow-lifted backdrop-blur dark:text-amber-300"
      >
        {status === "offline" ? (
          <WifiOff className="size-3.5 shrink-0" />
        ) : (
          <RefreshCw className="size-3.5 shrink-0 animate-spin" />
        )}
        {status === "offline"
          ? "Connexion perdue — reconnexion automatique…"
          : "Reconnexion en cours…"}
      </div>
    </div>
  );
}
