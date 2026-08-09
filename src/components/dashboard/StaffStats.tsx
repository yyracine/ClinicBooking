import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { formatPrice, formatShortDate } from "@/lib/clinic";
import { useQuery } from "convex/react";
import {
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Hourglass,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#0d9488",
  completed: "#10b981",
  cancelled: "#f43f5e",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  completed: "Terminé",
  cancelled: "Annulé",
};

function ChartTooltip({
  active,
  payload,
  label,
  money,
  labelFormatter,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number }[];
  label?: string | number;
  money?: boolean;
  labelFormatter?: (label: string | number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-border/70 bg-background px-3 py-2 text-xs shadow-lifted">
      <p className="font-semibold text-foreground">
        {labelFormatter ? labelFormatter(String(label)) : String(label)}
      </p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted-foreground">
          {p.name} :{" "}
          <span className="font-medium text-foreground">
            {money ? formatPrice(p.value) : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

export function StaffStats() {
  const stats = useQuery(api.stats.getDashboardStats);

  const statusData = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.statusCounts).map(([key, value]) => ({
      name: STATUS_LABELS[key] ?? key,
      key,
      value,
    }));
  }, [stats]);

  if (stats === undefined) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-56 animate-pulse rounded-2xl border border-border/70 bg-card"
          />
        ))}
      </div>
    );
  }

  const totalByStatus = statusData.reduce((s, d) => s + d.value, 0);
  const totalRevenue = stats.months.reduce((s, m) => s + m.total, 0);

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={<CircleDollarSign className="size-4" />}
          label="Encaissé (30 j)"
          value={formatPrice(stats.totals.revenue30d)}
          tone="text-primary"
        />
        <Kpi
          icon={<Banknote className="size-4" />}
          label="Encaissé aujourd'hui"
          value={formatPrice(stats.totals.revenueToday)}
        />
        <Kpi
          icon={<CalendarDays className="size-4" />}
          label="RDV aujourd'hui"
          value={stats.totals.todayCount}
        />
        <Kpi
          icon={<Hourglass className="size-4" />}
          label="RDV actifs"
          value={stats.totals.active}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue trend */}
        <Card className="border-border/70 p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold tracking-tight text-foreground">
                Chiffre d'affaires
              </h3>
              <p className="text-xs text-muted-foreground">
                Encaissé par mois — {formatPrice(totalRevenue)} sur 6 mois
              </p>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats.months}
                margin={{ top: 4, right: 4, left: -12, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip content={<ChartTooltip money />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Encaissé"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  fill="url(#revFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Appointments per day */}
        <Card className="border-border/70 p-5 shadow-soft">
          <h3 className="text-sm font-bold tracking-tight text-foreground">
            Rendez-vous
          </h3>
          <p className="text-xs text-muted-foreground">
            Par jour sur les 30 derniers jours
          </p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.days}
                margin={{ top: 4, right: 4, left: -28, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                  tickFormatter={(v) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(l: string | number) =>
                        formatShortDate(String(l))
                      }
                    />
                  }
                />
                <Bar
                  dataKey="count"
                  name="Rendez-vous"
                  radius={[4, 4, 0, 0]}
                  fill="#0d9488"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Status donut */}
        <Card className="border-border/70 p-5 shadow-soft">
          <h3 className="text-sm font-bold tracking-tight text-foreground">
            Répartition par statut
          </h3>
          <p className="text-xs text-muted-foreground">
            {totalByStatus} rendez-vous au total
          </p>
          <div className="mt-2 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {statusData.map((d) => (
                    <Cell key={d.key} fill={STATUS_COLORS[d.key] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {statusData.map((d) => (
              <div key={d.key} className="flex items-center gap-2 text-xs">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: STATUS_COLORS[d.key] ?? "#94a3b8" }}
                />
                <span className="truncate text-muted-foreground">{d.name}</span>
                <span className="ml-auto font-semibold text-foreground">
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Top doctors */}
        <Card className="border-border/70 p-5 shadow-soft lg:col-span-2">
          <h3 className="text-sm font-bold tracking-tight text-foreground">
            Activité des praticiens
          </h3>
          <p className="text-xs text-muted-foreground">
            Rendez-vous et montant encaissé par praticien
          </p>
          <div className="mt-4 space-y-4">
            {stats.byDoctor.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucune activité pour le moment.
              </p>
            )}
            {stats.byDoctor.map((d) => {
              const max = Math.max(
                1,
                ...stats.byDoctor.map((x) => x.revenue),
              );
              const pct = Math.round((d.revenue / max) * 100);
              return (
                <div key={d.name}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">
                      {d.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {d.count} RDV ·{" "}
                      <span className="font-semibold text-foreground">
                        {formatPrice(d.revenue)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone?: string;
}) {
  return (
    <Card className="border-border/70 p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        {label}
      </div>
      <p
        className={`mt-3 text-2xl font-bold tracking-tight text-foreground ${tone ?? ""}`}
      >
        {value}
      </p>
    </Card>
  );
}
