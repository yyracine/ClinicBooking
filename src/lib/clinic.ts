import {
  resolveConsultationPrice,
  type AcademicRank,
  type InsuranceLike,
  type PricingGrid,
} from "@/lib/pricing";
import { Id } from "@/convex/_generated/dataModel";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Baby,
  Eye,
  HeartPulse,
  Smile,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled";

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  completed: "Terminé",
  cancelled: "Annulé",
};

export const STATUS_ORDER: AppointmentStatus[] = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
];

/** Lucide icon per service (key stored in the DB). */
export const SERVICE_ICONS: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  "heart-pulse": HeartPulse,
  sparkles: Sparkles,
  baby: Baby,
  smile: Smile,
  eye: Eye,
};

export function serviceIcon(key: string | null | undefined): LucideIcon {
  if (key && key in SERVICE_ICONS) return SERVICE_ICONS[key];
  return Stethoscope;
}

/** Soft tint per service. */
export const SERVICE_TINTS: Record<string, string> = {
  teal: "bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  violet:
    "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300",
  indigo:
    "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
};

export function serviceTint(key: string | null | undefined): string {
  return (key && SERVICE_TINTS[key]) || SERVICE_TINTS.teal;
}

/** Avatar tint per practitioner. */
export const DOCTOR_TINTS: Record<string, string> = {
  teal: "bg-teal-100 text-teal-700",
  emerald: "bg-emerald-100 text-emerald-700",
  rose: "bg-rose-100 text-rose-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  orange: "bg-orange-100 text-orange-700",
  violet: "bg-violet-100 text-violet-700",
  purple: "bg-purple-100 text-purple-700",
  sky: "bg-sky-100 text-sky-700",
  cyan: "bg-cyan-100 text-cyan-700",
  indigo: "bg-indigo-100 text-indigo-700",
  blue: "bg-blue-100 text-blue-700",
};

export function doctorTint(key: string | null | undefined): string {
  return (key && DOCTOR_TINTS[key]) || DOCTOR_TINTS.teal;
}

/** Local "yyyy-MM-dd" key from a Date. */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "lundi 12 mai 2026" */
export function formatFullDate(dateKey: string): string {
  return format(parseISO(dateKey), "EEEE d MMMM yyyy", { locale: fr });
}

/** "lun. 12 mai" */
export function formatShortDate(dateKey: string): string {
  return format(parseISO(dateKey), "EEE d MMM", { locale: fr });
}

/** "09:30 – 10:00" */
export function formatTimeRange(time: string, durationMinutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const end = new Date(0, 0, 0, h, m + durationMinutes);
  return `${time} – ${format(end, "HH:mm")}`;
}

/** "45 000 FCFA" — local currency, no decimals. */
export function formatPrice(price: number): string {
  return `${price.toLocaleString("fr-FR")} FCFA`;
}

/** "Dr Camille Moreau" -> "CM" */
export function initials(name: string): string {
  return name
    .replace(/^Dr\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Appointment with doctor + service details joined (patient view). */
export interface AppointmentWithDetails {
  _id: Id<"appointments">;
  date: string;
  time: string;
  status: AppointmentStatus;
  notes?: string;
  amountPaid?: number;
  paidAt?: number;
  doctor: {
    name: string;
    title: string;
    color: string;
    /** Exceptional per-doctor tariff (FCFA) — primes over the pricing grid. */
    consultationPrice?: number;
    academicRank?: AcademicRank;
  } | null;
  service: {
    name: string;
    durationMinutes: number;
    price: number;
    icon: string;
    color: string;
    isGeneralist?: boolean;
  } | null;
}

/**
 * Effective price of an appointment: the doctor's exceptional tariff, else
 * the clinic's category pricing grid, else the service's own price.
 */
export function appointmentPrice(
  a: AppointmentWithDetails,
  grid?: PricingGrid | null,
): number {
  if (!a.doctor || !a.service) return 0;
  return resolveConsultationPrice(a.doctor, a.service, grid);
}

/** Appointment with patient details joined (staff view). */
export interface StaffAppointment extends AppointmentWithDetails {
  patient: { name: string | null; email: string | null; phone?: string | null };
  /** Insurance data used to compute the amount to collect. */
  insurance: InsuranceLike | null;
  /** Allergy alert for the staff planning. */
  hasAllergies?: boolean;
  allergies?: string[];
}

/** One consultation report of a patient's medical file. */
export interface VisitWithDoctor {
  _id: Id<"visits">;
  visitDate: string;
  report: string;
  /** Dossier enrichi : diagnostic, conseils, prochaine consultation. */
  diagnosis?: string;
  advice?: string;
  followUpDate?: string;
  medications: { name: string; dosage: string }[];
  exams: {
    name: string;
    status: "prescribed" | "done";
    comment?: string;
  }[];
  /** Vital signs measured during the visit (dossier enrichi). */
  weight?: number; // kg
  height?: number; // cm
  bloodPressure?: string; // ex. "12/8"
  temperature?: number; // °C
  /** Attached documents (exam results, scanned prescriptions…). */
  files: {
    _id: Id<"medicalFiles">;
    name: string;
    size?: number;
    mimeType?: string;
    url: string | null;
  }[];
  doctor: { name: string; title: string; color: string } | null;
}

/** Blood groups offered in the enriched medical record (fiche patient). */
export const BLOOD_GROUPS = [
  "A+",
  "A−",
  "B+",
  "B−",
  "AB+",
  "AB−",
  "O+",
  "O−",
  "Inconnu",
] as const;

/**
 * Human-readable vital signs of a visit, or null when none was recorded.
 * Ex: "71 kg · 170 cm · TA 12/8 · 36,8 °C"
 */
export function formatVitalSigns(visit: {
  weight?: number;
  height?: number;
  bloodPressure?: string;
  temperature?: number;
}): string | null {
  const parts: string[] = [];
  if (visit.weight != null) parts.push(`${visit.weight} kg`);
  if (visit.height != null) parts.push(`${visit.height} cm`);
  if (visit.bloodPressure) parts.push(`TA ${visit.bloodPressure}`);
  if (visit.temperature != null) {
    parts.push(`${String(visit.temperature).replace(".", ",")} °C`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Age in years computed from a "yyyy-MM-dd" birth date. */
export function computeAge(birthDate: string): number | null {
  const b = parseISO(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age -= 1;
  return age;
}

/* ------------------------------------------------------------------ */
/* Doctor working hours (fiche médecin)                                */
/* ------------------------------------------------------------------ */

export interface DoctorScheduleEntry {
  day: number; // JS getDay(): 0 = dimanche … 6 = samedi
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

/** Ordered day names matching JS getDay() (0 = dimanche). */
export const DAY_NAMES = [
  "Dimanche",
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
];

export const DAY_SHORT_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

/** Whether the doctor works on the given weekday (JS getDay()). */
export function doctorWorksOn(
  schedule: DoctorScheduleEntry[] | undefined | null,
  day: number,
): boolean {
  if (!schedule || schedule.length === 0) {
    // No fiche yet: fall back to the clinic default (closed Sundays).
    return day !== 0;
  }
  return schedule.some((e) => e.day === day);
}

/** "Lun 09:00–12:30 · Mar 14:00–17:30" */
export function formatSchedule(
  schedule: DoctorScheduleEntry[] | undefined | null,
): string {
  if (!schedule || schedule.length === 0) return "Horaires non renseignés";
  return schedule
    .map((e) => `${DAY_SHORT_NAMES[e.day]} ${e.start}–${e.end}`)
    .join(" · ");
}
