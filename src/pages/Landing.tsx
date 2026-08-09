import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/convex/_generated/api";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronRight,
  Clock,
  Coins,
  Download,
  MapPin,
  Menu,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import logo from "@/assets/logo.svg";
import {
  doctorTint,
  formatPrice,
  formatSchedule,
  initials,
  serviceIcon,
  serviceTint,
  type DoctorScheduleEntry,
} from "@/lib/clinic";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#services", label: "Services" },
  { href: "#demarche", label: "Comment ça marche" },
  { href: "#praticiens", label: "Praticiens" },
];

/** Fallback content shown while the live data is loading (or offline). */
interface ServiceInfo {
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  icon: string;
  color: string;
}

interface DoctorInfo {
  _id?: string;
  name: string;
  title: string;
  color: string;
  bio?: string;
  phone?: string;
  consultationPrice?: number;
  schedule?: DoctorScheduleEntry[];
  serviceName?: string;
  servicePrice?: number;
}

const FALLBACK_SERVICES: ServiceInfo[] = [
  {
    name: "Médecine générale",
    description:
      "Consultations de routine, prévention et suivi de votre santé au quotidien.",
    durationMinutes: 30,
    price: 10000,
    icon: "stethoscope",
    color: "teal",
  },
  {
    name: "Cardiologie",
    description:
      "Suivi cardiaque et dépistage des maladies cardiovasculaires.",
    durationMinutes: 30,
    price: 25000,
    icon: "heart-pulse",
    color: "rose",
  },
  {
    name: "Dermatologie",
    description:
      "Diagnostic et traitement des affections de la peau, des ongles et des cheveux.",
    durationMinutes: 30,
    price: 15000,
    icon: "sparkles",
    color: "amber",
  },
  {
    name: "Pédiatrie",
    description:
      "Suivi médical des nourrissons, enfants et adolescents, vaccinations incluses.",
    durationMinutes: 30,
    price: 12000,
    icon: "baby",
    color: "violet",
  },
  {
    name: "Dentisterie",
    description:
      "Soins dentaires, détartrage, contrôle et conseils d'hygiène bucco-dentaire.",
    durationMinutes: 30,
    price: 18000,
    icon: "smile",
    color: "sky",
  },
  {
    name: "Ophtalmologie",
    description: "Examen de la vue, dépistage et suivi des troubles visuels.",
    durationMinutes: 30,
    price: 15000,
    icon: "eye",
    color: "indigo",
  },
];

const FALLBACK_DOCTORS: DoctorInfo[] = [
  {
    name: "Dr Camille Moreau",
    title: "Médecin généraliste",
    color: "teal",
    bio: "Plus de 12 ans d'expérience en médecine de famille.",
    phone: "+225 07 00 01 02 03",
    consultationPrice: 10000,
    serviceName: "Médecine générale",
    servicePrice: 10000,
  },
  {
    name: "Dr Sophie Dubois",
    title: "Cardiologue",
    color: "rose",
    bio: "Spécialiste du suivi de l'insuffisance cardiaque.",
    phone: "+225 07 00 01 02 05",
    consultationPrice: 25000,
    serviceName: "Cardiologie",
    servicePrice: 25000,
  },
  {
    name: "Dr Léa Fontaine",
    title: "Dermatologue",
    color: "amber",
    bio: "Passionnée de dermatologie esthétique.",
    phone: "+225 07 00 01 02 07",
    consultationPrice: 15000,
    serviceName: "Dermatologie",
    servicePrice: 15000,
  },
  {
    name: "Dr Chloé Bernard",
    title: "Pédiatre",
    color: "violet",
    bio: "À l'écoute des tout-petits et de leurs parents.",
    phone: "+225 07 00 01 02 09",
    consultationPrice: 12000,
    serviceName: "Pédiatrie",
    servicePrice: 12000,
  },
  {
    name: "Dr Emma Rousseau",
    title: "Chirurgien-dentiste",
    color: "sky",
    bio: "Soins conservateurs et prévention, sans douleur.",
    phone: "+225 07 00 01 02 11",
    consultationPrice: 18000,
    serviceName: "Dentisterie",
    servicePrice: 18000,
  },
  {
    name: "Dr Inès Lambert",
    title: "Ophtalmologue",
    color: "indigo",
    bio: "Dépistage du glaucome et suivi de la myopie.",
    phone: "+225 07 00 01 02 13",
    consultationPrice: 15000,
    serviceName: "Ophtalmologie",
    servicePrice: 15000,
  },
];

const STEPS = [
  {
    icon: CalendarPlus,
    title: "Choisissez votre service",
    description:
      "Médecine générale, cardiologie, pédiatrie… sélectionnez la spécialité dont vous avez besoin.",
  },
  {
    icon: Sparkles,
    title: "Sélectionnez un praticien",
    description:
      "Consultez les disponibilités de nos praticiens et choisissez le créneau qui vous arrange.",
  },
  {
    icon: CalendarCheck2,
    title: "Confirmez en un clic",
    description:
      "Votre rendez-vous est confirmé instantanément. Annulation gratuite jusqu'à 24 h avant.",
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55, ease: "easeOut" as const },
};

const StethIcon = serviceIcon("stethoscope");

export default function Landing() {
  const servicesQuery = useQuery(api.catalog.listServices);
  const doctorsQuery = useQuery(api.catalog.listDoctors);

  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorInfo | null>(null);

  const services: ServiceInfo[] | undefined = useMemo(
    () =>
      servicesQuery?.map((s) => ({
        name: s.name,
        description: s.description,
        durationMinutes: s.durationMinutes,
        price: s.price,
        icon: s.icon,
        color: s.color,
      })),
    [servicesQuery],
  );

  const doctors: DoctorInfo[] | undefined = useMemo(() => {
    if (!doctorsQuery) return undefined;
    return doctorsQuery.map((d) => {
      const service = servicesQuery?.find((s) => s._id === d.serviceId);
      return {
        _id: d._id,
        name: d.name,
        title: d.title,
        color: d.color,
        bio: d.bio,
        phone: d.phone,
        consultationPrice: d.consultationPrice,
        schedule: d.schedule,
        serviceName: service?.name,
        servicePrice: service?.price,
      };
    });
  }, [doctorsQuery, servicesQuery]);

  const heroDoctors = doctors ?? FALLBACK_DOCTORS;

  const normalized = query.trim().toLocaleLowerCase("fr");
  const filteredServices = (services ?? FALLBACK_SERVICES).filter(
    (s) =>
      normalized.length === 0 ||
      `${s.name} ${s.description}`
        .toLocaleLowerCase("fr")
        .includes(normalized),
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={logo}
              alt="Clinic Bookings"
              width={34}
              height={34}
              className="rounded-[10px]"
            />
            <span className="text-[15px] font-bold tracking-tight">
              Clinic Bookings
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle />
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/auth">Se connecter</Link>
            </Button>
            <Button asChild className="rounded-full shadow-soft">
              <Link to="/auth?returnTo=/dashboard">
                Prendre rendez-vous
              </Link>
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted md:hidden"
            aria-label="Menu"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-border/60 bg-background px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-2.5">
              <span className="text-sm font-medium text-foreground">
                Apparence
              </span>
              <ThemeToggle />
            </div>
            <div className="mt-2 flex flex-col gap-2">
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/auth">Se connecter</Link>
              </Button>
              <Button
                asChild
                className="rounded-full"
                onClick={() => setMenuOpen(false)}
              >
                <Link to="/auth?returnTo=/dashboard">
                  Prendre rendez-vous
                </Link>
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 70% 0%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 70%)",
          }}
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <Badge className="mb-5 border-transparent bg-primary/10 px-3 py-1.5 text-primary">
              <span className="relative mr-1.5 flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              Réservation en ligne 24 h/24
            </Badge>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Votre santé,{" "}
              <span className="text-primary">sans attente.</span>
            </h1>
            <p className="mt-5 max-w-lg text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
              Prenez rendez-vous avec l'un de nos 12 praticiens en moins de
              deux minutes. Choisissez votre service, votre créneau et
              recevez une confirmation immédiate.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                asChild
                size="lg"
                className="rounded-full px-7 shadow-lifted"
              >
                <Link to="/auth?returnTo=/dashboard">
                  Prendre rendez-vous
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full px-7"
              >
                <a href="#services">Découvrir nos services</a>
              </Button>
            </div>
            <div className="mt-9 flex items-center gap-4">
              <div className="flex -space-x-2">
                {heroDoctors.slice(0, 4).map((d) => (
                  <span
                    key={d.name}
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold",
                      doctorTint(d.color),
                    )}
                  >
                    {initials(d.name)}
                  </span>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">4,9/5</span>{" "}
                · plus de 12 000 rendez-vous réservés
              </p>
            </div>
          </motion.div>

          {/* Hero mockup */}
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            className="relative mx-auto w-full max-w-md"
          >
            <div
              aria-hidden
              className="absolute -inset-8 rounded-[2.5rem] bg-primary/5 blur-2xl"
            />
            <div className="relative rounded-3xl border border-border/70 bg-card p-6 shadow-lifted sm:p-7">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">
                  Votre prochain rendez-vous
                </p>
                <Badge className="border-transparent bg-primary/10 text-primary">
                  <Check className="size-3" />
                  Confirmé
                </Badge>
              </div>
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border/70 bg-background p-3.5">
                <span className="flex size-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300">
                  <StethIcon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    Dr Camille Moreau
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Médecine générale · Consultation
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border/70 bg-background p-3.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Date
                  </p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    mar. 12 mai
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background p-3.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Horaire
                  </p>
                  <p className="mt-1 text-sm font-bold text-foreground">
                    09:30 – 10:00
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-primary p-3.5 text-primary-foreground">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <CalendarCheck2 className="size-4" />
                  Rappel envoyé par e-mail
                </span>
                <Check className="size-4" />
              </div>
            </div>

            {/* Floating chips */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-3 -top-5 flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-3.5 py-2.5 shadow-lifted sm:-right-8"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="size-4" />
              </span>
              <div className="leading-tight">
                <p className="text-xs font-bold text-foreground">14:30 libre</p>
                <p className="text-[10px] text-muted-foreground">
                  dès demain
                </p>
              </div>
            </motion.div>
            <motion.div
              animate={{ y: [0, 10, 0] }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1,
              }}
              className="absolute -bottom-5 -left-3 flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-3.5 py-2.5 shadow-lifted sm:-left-8"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                <ShieldCheck className="size-4" />
              </span>
              <div className="leading-tight">
                <p className="text-xs font-bold text-foreground">
                  Annulation gratuite
                </p>
                <p className="text-[10px] text-muted-foreground">
                  jusqu'à 24 h avant
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ---------- Stats ---------- */}
      <section className="border-y border-border/60 bg-card/60">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {[
            ["12", "praticiens qualifiés"],
            ["6", "spécialités médicales"],
            ["30 min", "de consultation"],
            ["4,9/5", "de satisfaction"],
          ].map(([value, label]) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                {value}
              </p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Services ---------- */}
      <section id="services" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-24">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Nos services
          </p>
          <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
            Une prise en charge pour toute la famille
          </h2>
          <p className="mt-4 text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
            Six spécialités, des créneaux de 30 minutes et des praticiens à
            l'écoute. Choisissez le service qui vous correspond.
          </p>
        </motion.div>

        <div className="mx-auto mt-10 max-w-md">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un service…"
              className="rounded-full border-border/70 bg-card pl-10 shadow-soft"
            />
          </div>
        </div>

        {services === undefined ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-44 animate-pulse rounded-2xl border border-border/70 bg-card"
              />
            ))}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((s, i) => {
              const Icon = serviceIcon(s.icon);
              return (
                <motion.div
                  key={s.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
                  className="group relative flex flex-col rounded-2xl border border-border/70 bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lifted"
                >
                  <span
                    className={cn(
                      "flex size-11 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
                      serviceTint(s.color),
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-foreground">
                    {s.name}
                  </h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                    {s.description}
                  </p>
                  <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
                    <span className="text-xs text-muted-foreground">
                      {s.durationMinutes} min · {formatPrice(s.price)}
                    </span>
                    <Button
                      asChild
                      variant="ghost"
                      className="-mr-2 h-8 gap-1 rounded-full px-3 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <Link to="/auth?returnTo=/dashboard">
                        Réserver
                        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {services !== undefined && filteredServices.length === 0 && (
          <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted">
              <Search className="size-5 text-muted-foreground" />
            </span>
            <p className="text-sm font-semibold text-foreground">
              Aucun service ne correspond à «&nbsp;{query}&nbsp;»
            </p>
            <p className="text-xs text-muted-foreground">
              Essayez un autre terme, comme « cœur » ou « dent ».
            </p>
          </div>
        )}
      </section>

      {/* ---------- How it works ---------- */}
      <section id="demarche" className="scroll-mt-20 border-y border-border/60 bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Comment ça marche
            </p>
            <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              Un rendez-vous en trois étapes
            </h2>
          </motion.div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="relative rounded-2xl border border-border/70 bg-card p-6 shadow-soft"
                >
                  <span className="absolute right-5 top-5 text-4xl font-extrabold text-border/80">
                    {i + 1}
                  </span>
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-base font-bold text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {step.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- Practitioners ---------- */}
      <section id="praticiens" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 lg:py-24">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Nos praticiens
          </p>
          <h2 className="mt-3 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
            Des experts à votre écoute
          </h2>
          <p className="mt-4 text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
            Consultez la fiche de chaque praticien : spécialité, disponibilités
            et tarif de la consultation.
          </p>
        </motion.div>

        {doctors === undefined ? (
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-2xl border border-border/70 bg-card"
              />
            ))}
          </div>
        ) : (
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {doctors.map((d, i) => {
              const price = d.consultationPrice ?? d.servicePrice;
              return (
                <motion.div
                  key={d._id ?? d.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.45, delay: (i % 4) * 0.06 }}
                  className="group flex cursor-pointer flex-col items-center rounded-2xl border border-border/70 bg-card px-4 py-6 text-center shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lifted"
                  onClick={() => setSelectedDoctor(d)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedDoctor(d);
                    }
                  }}
                >
                  <span
                    className={cn(
                      "flex size-14 items-center justify-center rounded-full text-base font-bold transition-transform duration-300 group-hover:scale-110",
                      doctorTint(d.color),
                    )}
                  >
                    {initials(d.name)}
                  </span>
                  <p className="mt-3 text-sm font-semibold leading-tight text-foreground">
                    {d.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {d.serviceName ?? d.title}
                  </p>
                  {price != null ? (
                    <p className="mt-2 flex items-center gap-1 text-sm font-bold text-primary">
                      <Coins className="size-3.5" />
                      {formatPrice(price)}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Tarif à la réservation
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-3 h-7 gap-1 rounded-full px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDoctor(d);
                    }}
                  >
                    Voir la fiche
                    <ChevronRight className="size-3.5" />
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Testimonial */}
        <motion.figure
          {...fadeUp}
          className="mx-auto mt-20 max-w-2xl rounded-3xl border border-border/70 bg-card p-8 text-center shadow-soft sm:p-10"
        >
          <div className="mx-auto flex justify-center gap-1 text-primary">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg
                key={i}
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-4"
              >
                <path d="M9.05 2.93c.3-.92 1.6-.92 1.9 0l1.28 3.95a1 1 0 0 0 .95.69h4.16c.97 0 1.37 1.24.59 1.81l-3.37 2.45a1 1 0 0 0-.36 1.12l1.29 3.95c.3.92-.76 1.69-1.54 1.12l-3.37-2.44a1 1 0 0 0-1.18 0l-3.37 2.44c-.78.57-1.83-.2-1.54-1.12l1.29-3.95a1 1 0 0 0-.36-1.12L2.07 9.38c-.78-.57-.38-1.81.59-1.81h4.16a1 1 0 0 0 .95-.69l1.28-3.95Z" />
              </svg>
            ))}
          </div>
          <blockquote className="mt-5 text-pretty text-lg font-medium leading-8 text-foreground">
            « J'ai réservé ma consultation en 30 secondes, un soir après le
            travail. Le rappel par e-mail m'a évité d'oublier — un vrai gain
            de temps. »
          </blockquote>
          <figcaption className="mt-4 text-sm font-semibold text-foreground">
            Marie D.
            <span className="font-normal text-muted-foreground">
              {" "}
              · patiente de la clinique
            </span>
          </figcaption>
        </motion.figure>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <motion.div
          {...fadeUp}
          className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground shadow-lifted sm:px-10 sm:py-16"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 60% at 20% 0%, rgba(255,255,255,0.18), transparent 60%)",
            }}
          />
          <div className="relative">
            <h2 className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl">
              Prêt à prendre rendez-vous{"\u00A0"}?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-6 text-primary-foreground/85 sm:text-base">
              Rejoignez l'espace en ligne de la clinique et réservez votre
              prochaine consultation en moins de deux minutes.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-white text-primary hover:bg-white/90"
              >
                <Link to="/auth?returnTo=/dashboard">
                  Prendre rendez-vous
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="rounded-full text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
              >
                <Link to="/auth">Se connecter</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-border/60 bg-card/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
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
            </div>
            <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
              La plateforme de prise de rendez-vous en ligne de la clinique :
              réservez en moins de deux minutes, recevez vos rappels par e-mail
              et gérez vos rendez-vous en toute simplicité.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">
              Navigation
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  to="/auth?returnTo=/dashboard"
                  className="text-muted-foreground transition-colors hover:text-primary"
                >
                  Prendre rendez-vous
                </Link>
              </li>
              <li>
                <Link
                  to="/auth"
                  className="text-muted-foreground transition-colors hover:text-primary"
                >
                  Espace administration
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">
              Contact
            </p>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                12 rue des Lilas, 75011 Paris
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0 text-primary" />
                01 45 00 12 34
              </li>
              <li className="flex items-center gap-2.5">
                <Clock className="size-4 shrink-0 text-primary" />
                Lun – Sam · 9 h – 18 h
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
            <p>© {new Date().getFullYear()} Clinic Bookings. Tous droits réservés.</p>
            <div className="flex items-center gap-4">
              <p>Fait avec soin pour votre santé.</p>
              <a
                href="/clinic-bookings-src.zip"
                download
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 font-medium text-foreground/80 shadow-soft transition-colors hover:border-primary/30 hover:text-primary"
              >
                <Download className="size-3.5" />
                Télécharger le code source
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ---------- Public doctor sheet ---------- */}
      {selectedDoctor && (
        <DoctorSheet
          doctor={selectedDoctor}
          onClose={() => setSelectedDoctor(null)}
        />
      )}
    </div>
  );
}

function DoctorSheet({
  doctor,
  onClose,
}: {
  doctor: DoctorInfo;
  onClose: () => void;
}) {
  const price = doctor.consultationPrice ?? doctor.servicePrice;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fiche du praticien</DialogTitle>
          <DialogDescription>
            Ses disponibilités, son tarif et ses coordonnées en un coup d'œil.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <span
            className={cn(
              "flex size-14 shrink-0 items-center justify-center rounded-full text-base font-bold",
              doctorTint(doctor.color),
            )}
          >
            {initials(doctor.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-foreground">
              {doctor.name}
            </p>
            <p className="truncate text-sm font-medium text-primary">
              {doctor.serviceName ?? doctor.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {doctor.title}
            </p>
          </div>
        </div>

        {/* Tariff */}
        <div className="flex items-center justify-between rounded-2xl border border-primary/25 bg-primary/[0.05] px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Coins className="size-4 text-primary" />
            Consultation
          </span>
          <span className="text-lg font-bold tracking-tight text-primary">
            {price != null ? formatPrice(price) : "Tarif à la réservation"}
          </span>
        </div>

        <div className="space-y-3">
          {doctor.bio && (
            <p className="text-sm leading-6 text-muted-foreground">
              {doctor.bio}
            </p>
          )}
          <div className="flex items-center gap-3 text-sm text-foreground">
            <Phone className="size-4 shrink-0 text-primary" />
            {doctor.phone ?? "Téléphone non renseigné"}
          </div>
          <div className="flex items-start gap-3 text-sm text-foreground">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="leading-5">
              {formatSchedule(doctor.schedule)}
            </span>
          </div>
        </div>

        <DialogFooter className="sm:justify-start">
          <Button asChild className="w-full rounded-full">
            <Link
              to="/auth?returnTo=/dashboard"
              onClick={onClose}
            >
              Réserver avec ce praticien
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
