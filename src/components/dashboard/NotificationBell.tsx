import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import {
  Bell,
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  CheckCheck,
  MailOpen,
  UserPlus,
  XCircle,
} from "lucide-react";

const TYPE_ICONS: Record<string, typeof Bell> = {
  "appointment.confirmed": CheckCircle2,
  "appointment.reminder": BellRing,
  "appointment.cancelled": XCircle,
  "waiting.slot": CalendarCheck2,
  "appointment.booked": UserPlus,
};

function typeIcon(type: string) {
  return TYPE_ICONS[type] ?? MailOpen;
}

/** "à l'instant", "il y a 5 min", "il y a 3 h", "il y a 2 j"… */
function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

/**
 * In-app notification bell: unread badge + dropdown list. Used in the
 * dashboard header for patients and staff alike (see `myNotifications`).
 */
export function NotificationBell({
  className,
}: {
  className?: string;
}) {
  const notifications = useQuery(api.notifications.myNotifications);
  const markRead = useMutation(api.notifications.markRead);

  const unread = (notifications ?? []).filter((n) => !n.read).length;
  const items = notifications ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative rounded-full text-muted-foreground", className)}
          title="Notifications"
          aria-label={`Notifications${unread > 0 ? ` (${unread} non lues)` : ""}`}
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="p-0 text-sm font-bold text-foreground">
            Notifications
          </DropdownMenuLabel>
          {unread > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void markRead({})}
              className="h-7 gap-1 rounded-full px-2.5 text-xs text-primary"
            >
              <CheckCheck className="size-3.5" />
              Tout marquer comme lu
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="m-0" />
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Bell className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              Aucune notification
            </p>
            <p className="text-xs text-muted-foreground">
              Confirmation, rappels de rendez-vous et créneaux libérés
              apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {items.map((n) => {
              const Icon = typeIcon(n.type);
              const unreadItem = !n.read;
              return (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => void markRead({ id: n._id })}
                  className={cn(
                    "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                    unreadItem && "bg-primary/[0.04]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                      unreadItem
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "truncate text-sm font-semibold text-foreground",
                          !unreadItem && "font-medium text-muted-foreground",
                        )}
                      >
                        {n.title}
                      </span>
                      {unreadItem && (
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      {n.body}
                    </span>
                    <span className="mt-1 block text-[10px] text-muted-foreground/70">
                      {relativeTime(n._creationTime)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
