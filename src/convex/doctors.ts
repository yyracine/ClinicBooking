import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  MutationCtx,
  QueryCtx,
  mutation,
  query,
} from "./_generated/server";

/**
 * Doctor record cards (fiche médecin), filled by the clinic staff.
 *
 * Each fiche holds the doctor's identity (nom, prénom), specialty (service),
 * phone number and weekly working hours (jours et heures de vacation).
 * The working hours drive the available booking slots (see catalog.ts).
 */

const scheduleEntry = v.object({
  day: v.number(), // JS getDay(): 0 = dimanche … 6 = samedi
  start: v.string(), // "HH:mm"
  end: v.string(), // "HH:mm"
});

/** Next free tint from the doctor avatar palette. */
const DOCTOR_TINTS = [
  "teal",
  "emerald",
  "rose",
  "red",
  "amber",
  "orange",
  "violet",
  "purple",
  "sky",
  "cyan",
  "indigo",
  "blue",
];

async function requireStaff(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Vous devez être connecté.");
  }
  const user = await ctx.db.get<"users">(userId);
  if (user?.role !== "staff") {
    throw new Error("Accès réservé à l'administration de la clinique.");
  }
  return userId;
}

/** Keep only valid schedule entries (well-formed hours). */
function cleanSchedule(
  schedule: { day: number; start: string; end: string }[] | undefined,
) {
  if (!schedule || schedule.length === 0) return undefined;
  const clean = schedule
    .filter(
      (e) =>
        Number.isInteger(e.day) &&
        e.day >= 0 &&
        e.day <= 6 &&
        /^\d{2}:\d{2}$/.test(e.start) &&
        /^\d{2}:\d{2}$/.test(e.end),
    )
    .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  return clean.length > 0 ? clean : undefined;
}

function composeName(firstName: string, lastName: string): string {
  return `Dr ${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, " ");
}

/** Validate the consultation price: whole FCFA amount, no decimals. */
function cleanPrice(price: number | undefined): number | undefined {
  if (price == null) return undefined;
  if (!Number.isFinite(price) || !Number.isInteger(price) || price < 0) {
    throw new Error("Indiquez un prix de consultation valide (FCFA, sans décimales).");
  }
  return price;
}

/** Staff: create a doctor and their record card (fiche médecin). */
export const createDoctor = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    serviceId: v.id("services"),
    title: v.optional(v.string()),
    bio: v.optional(v.string()),
    phone: v.optional(v.string()),
    category: v.union(v.literal("generaliste"), v.literal("specialiste"), v.literal("professeur")),
    schedule: v.optional(v.array(scheduleEntry)),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    if (!firstName || !lastName) {
      throw new Error("Indiquez le nom et le prénom du médecin.");
    }

    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Spécialité introuvable.");

    // Only the full display name is checked: two doctors may share a first
    // name (e.g. two "Camille"), but never the exact same "Dr Prénom Nom".
    const existing = await ctx.db
      .query("doctors")
      .filter((q) => q.eq(q.field("name"), composeName(firstName, lastName)))
      .first();
    if (existing) {
      throw new Error("Un médecin portant ce nom existe déjà.");
    }

    const count = await ctx.db.query("doctors").collect();

    return await ctx.db.insert("doctors", {
      name: composeName(firstName, lastName),
      firstName,
      lastName,
      serviceId: args.serviceId,
      title: args.title?.trim() || service.name,
      bio: args.bio?.trim() || "",
      phone: args.phone?.trim() || undefined,
      category: args.category,
      schedule: cleanSchedule(args.schedule),
      color: DOCTOR_TINTS[count.length % DOCTOR_TINTS.length],
    });
  },
});

/** Staff: update a doctor's record card (fiche médecin). */
export const updateDoctor = mutation({
  args: {
    doctorId: v.id("doctors"),
    firstName: v.string(),
    lastName: v.string(),
    serviceId: v.id("services"),
    title: v.optional(v.string()),
    bio: v.optional(v.string()),
    phone: v.optional(v.string()),
    category: v.union(v.literal("generaliste"), v.literal("specialiste"), v.literal("professeur")),
    schedule: v.optional(v.array(scheduleEntry)),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor) throw new Error("Médecin introuvable.");

    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    if (!firstName || !lastName) {
      throw new Error("Indiquez le nom et le prénom du médecin.");
    }

    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Spécialité introuvable.");

    // Keep the display name in sync with the fiche identity.
    const name = composeName(firstName, lastName);

    await ctx.db.patch(args.doctorId, {
      name,
      firstName,
      lastName,
      serviceId: args.serviceId,
      title: args.title?.trim() || service.name,
      bio: args.bio?.trim() || "",
      phone: args.phone?.trim() || undefined,
      category: args.category,
      schedule: cleanSchedule(args.schedule),
    });
  },
});

export type DoctorScheduleEntry = {
  day: number;
  start: string;
  end: string;
};

/* ------------------------------------------------------------------ */
/* Doctor days off (congés / indisponibilités)                         */
/* ------------------------------------------------------------------ */

type DoctorCtx = QueryCtx | MutationCtx;

async function requireStaffAny(ctx: DoctorCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Vous devez être connecté.");
  }
  const user = await ctx.db.get<"users">(userId);
  if (user?.role !== "staff") {
    throw new Error("Accès réservé à l'administration de la clinique.");
  }
  return userId;
}

/** Regex for a "yyyy-MM-dd" date key. */
function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Staff: every declared off-day period, with the doctor's name. */
export const listDoctorOffDays = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffAny(ctx);
    const periods = await ctx.db.query("doctorOffDays").collect();
    const withDoctors = await Promise.all(
      periods.map(async (p) => {
        const doctor = await ctx.db.get(p.doctorId);
        return {
          _id: p._id,
          doctorId: p.doctorId,
          startDate: p.startDate,
          endDate: p.endDate,
          reason: p.reason,
          doctor: doctor
            ? {
                name: doctor.name,
                title: doctor.title,
                color: doctor.color,
              }
            : null,
        };
      }),
    );
    return withDoctors.sort((a, b) =>
      b.endDate.localeCompare(a.endDate),
    );
  },
});

/** Staff: declare a period when a doctor is unavailable (vacation…). */
export const addDoctorOffDays = mutation({
  args: {
    doctorId: v.id("doctors"),
    startDate: v.string(),
    endDate: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor) throw new Error("Médecin introuvable.");

    if (!isDateKey(args.startDate) || !isDateKey(args.endDate)) {
      throw new Error("Dates invalides.");
    }
    if (args.endDate < args.startDate) {
      throw new Error("La date de fin doit être après la date de début.");
    }

    return await ctx.db.insert("doctorOffDays", {
      doctorId: args.doctorId,
      startDate: args.startDate,
      endDate: args.endDate,
      reason: args.reason?.trim() || undefined,
    });
  },
});

/** Staff: remove a declared off-day period. */
export const removeDoctorOffDays = mutation({
  args: { offDaysId: v.id("doctorOffDays") },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const period = await ctx.db.get(args.offDaysId);
    if (!period) throw new Error("Période introuvable.");
    await ctx.db.delete(args.offDaysId);
  },
});
