import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, type AppointmentStatus } from "@/lib/clinic";

const STYLES: Record<AppointmentStatus, string> = {
  pending:
    "border-transparent bg-amber-500/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300",
  confirmed:
    "border-transparent bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary",
  completed:
    "border-transparent bg-muted text-muted-foreground dark:bg-muted/60",
  cancelled:
    "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/15",
};

export function StatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", STYLES[status], className)}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
