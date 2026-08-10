import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  appointmentPrice,
  doctorTint,
  formatPrice,
  formatShortDate,
  formatTimeRange,
  initials,
  serviceIcon,
  type AppointmentWithDetails,
} from "@/lib/clinic";
import type { PricingGrid } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { CircleCheck } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { createElement, type ReactNode } from "react";

export function AppointmentCard({
  appointment,
  actions,
  override,
  className,
  grid,
}: {
  appointment: AppointmentWithDetails;
  actions?: ReactNode;
  /** When provided (staff view), replaces the doctor block with a person block. */
  override?: { title: string; subtitle: string; tint: string };
  className?: string;
  grid?: PricingGrid | null;
}) {
  const doctor = appointment.doctor;
  const service = appointment.service;
  const day = format(parseISO(appointment.date), "d", { locale: fr });
  const month = format(parseISO(appointment.date), "MMM", { locale: fr });
  const isOverride = override != null;

  return (
    <Card
      className={cn(
        "group flex items-center gap-4 border-border/70 bg-card p-4 shadow-soft transition-all duration-200 hover:border-primary/25 hover:shadow-lifted sm:gap-5 sm:p-5",
        className,
      )}
    >
      {/* Date block */}
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-border/70 bg-background">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">
          {month}
        </span>
        <span className="text-xl font-bold leading-none text-foreground">
          {day}
        </span>
      </div>

      {/* Person / practitioner block */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-9 shrink-0 rounded-full">
            <AvatarFallback
              className={cn(
                "text-xs font-semibold",
                isOverride ? override.tint : doctorTint(doctor?.color),
              )}
            >
              {initials(isOverride ? override.title : (doctor?.name ?? "?"))}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {isOverride ? override.title : (doctor?.name ?? "Praticien")}
              {!isOverride && doctor?.title && (
                <span className="ml-1.5 hidden font-normal text-muted-foreground sm:inline">
                  · {doctor.title}
                </span>
              )}
            </p>
            {isOverride ? (
              <p className="truncate text-xs text-muted-foreground">
                {override.subtitle}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                {service &&
                  createElement(serviceIcon(service.icon), {
                    className: "size-3.5 shrink-0",
                  })}
                <span className="truncate">
                  {service?.name ?? "Consultation"} ·{" "}
                  {formatShortDate(appointment.date)} ·{" "}
                  {formatTimeRange(
                    appointment.time,
                    service?.durationMinutes ?? 30,
                  )}
                  {service && (
                    <span className="hidden sm:inline">
                      {" "}
                      · {formatPrice(appointmentPrice(appointment, grid))}
                    </span>
                  )}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        <StatusBadge status={appointment.status} />
        {appointment.status === "confirmed" &&
          appointment.amountPaid != null && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              <CircleCheck className="size-3.5" />
              Payé · {formatPrice(appointment.amountPaid)}
            </span>
          )}
        {actions}
      </div>
    </Card>
  );
}
