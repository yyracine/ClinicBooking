import {
  PRICING_GRID_KEY,
  STAFF_PASSWORD_DEFAULT,
  STAFF_PASSWORD_KEY,
} from "./settings";
import { DEFAULT_PRICING_GRID } from "../lib/pricing";
import { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";

/**
 * Seed data for the clinic demo: services and doctors.
 * The `key` field is only used to link doctors to services and is stripped
 * before inserting.
 */
const SEED_SERVICES = [
  {
    key: "general",
    name: "Médecine générale",
    description:
      "Consultations de routine, prévention et suivi de votre santé au quotidien.",
    durationMinutes: 30,
    price: 10000, // FCFA
    icon: "stethoscope",
    color: "teal",
    isGeneralist: true,
  },
  {
    key: "cardio",
    name: "Cardiologie",
    description:
      "Suivi cardiaque, électrocardiogramme et dépistage des maladies cardiovasculaires.",
    durationMinutes: 30,
    price: 25000, // FCFA
    icon: "heart-pulse",
    color: "rose",
  },
  {
    key: "derma",
    name: "Dermatologie",
    description:
      "Diagnostic et traitement des affections de la peau, des ongles et des cheveux.",
    durationMinutes: 30,
    price: 15000, // FCFA
    icon: "sparkles",
    color: "amber",
  },
  {
    key: "pediatrie",
    name: "Pédiatrie",
    description:
      "Suivi médical des nourrissons, enfants et adolescents, vaccinations incluses.",
    durationMinutes: 30,
    price: 12000, // FCFA
    icon: "baby",
    color: "violet",
  },
  {
    key: "dentaire",
    name: "Dentisterie",
    description:
      "Soins dentaires, détartrage, contrôle et conseils d'hygiène bucco-dentaire.",
    durationMinutes: 30,
    price: 18000, // FCFA
    icon: "smile",
    color: "sky",
  },
  {
    key: "ophtalmo",
    name: "Ophtalmologie",
    description:
      "Examen de la vue, dépistage et suivi des troubles visuels de l'adulte.",
    durationMinutes: 30,
    price: 15000, // FCFA
    icon: "eye",
    color: "indigo",
  },
];

type SeedSchedule = { day: number; start: string; end: string };

type SeedDoctor = {
  name: string;
  firstName: string;
  lastName: string;
  serviceKey: string;
  title: string;
  bio: string;
  phone: string;
  category: "generaliste" | "specialiste" | "professeur";
  schedule: SeedSchedule[];
  color: string;
};

const DAY = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 } as const;

/** Local "yyyy-MM-dd" key from a Date. */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday–Friday 9h–12h30 + 14h–17h30, Saturday morning. */
const FULL_WEEK_SCHEDULE: SeedSchedule[] = [
  { day: DAY.MON, start: "09:00", end: "12:30" },
  { day: DAY.MON, start: "14:00", end: "17:30" },
  { day: DAY.TUE, start: "09:00", end: "12:30" },
  { day: DAY.TUE, start: "14:00", end: "17:30" },
  { day: DAY.WED, start: "09:00", end: "12:30" },
  { day: DAY.WED, start: "14:00", end: "17:30" },
  { day: DAY.THU, start: "09:00", end: "12:30" },
  { day: DAY.THU, start: "14:00", end: "17:30" },
  { day: DAY.FRI, start: "09:00", end: "12:30" },
  { day: DAY.FRI, start: "14:00", end: "17:30" },
  { day: DAY.SAT, start: "09:00", end: "12:30" },
];

/** Monday–Friday mornings only. */
const MORNINGS_ONLY_SCHEDULE: SeedSchedule[] = [
  { day: DAY.MON, start: "08:30", end: "12:30" },
  { day: DAY.TUE, start: "08:30", end: "12:30" },
  { day: DAY.WED, start: "08:30", end: "12:30" },
  { day: DAY.THU, start: "08:30", end: "12:30" },
  { day: DAY.FRI, start: "08:30", end: "12:30" },
];

/** Tuesday + Thursday afternoons (specialists). */
const SPECIALIST_SCHEDULE: SeedSchedule[] = [
  { day: DAY.TUE, start: "09:00", end: "12:30" },
  { day: DAY.TUE, start: "14:00", end: "17:00" },
  { day: DAY.THU, start: "09:00", end: "12:30" },
  { day: DAY.THU, start: "14:00", end: "17:00" },
];

const SEED_DOCTORS: SeedDoctor[] = [
  // Médecine générale
  {
    name: "Dr Camille Moreau", firstName: "Camille", lastName: "Moreau", serviceKey: "general",
    title: "Médecin généraliste", bio: "Plus de 12 ans d'expérience en médecine de famille.",
    phone: "+225 07 00 01 02 03", category: "generaliste", schedule: FULL_WEEK_SCHEDULE, color: "teal",
  },
  {
    name: "Dr Julien Lefèvre", firstName: "Julien", lastName: "Lefèvre", serviceKey: "general",
    title: "Médecin généraliste", bio: "Diplômé de Paris-Descartes, attentif à la prévention.",
    phone: "+225 07 00 01 02 04", category: "generaliste", schedule: MORNINGS_ONLY_SCHEDULE, color: "emerald",
  },
  // Cardiologie
  {
    name: "Dr Sophie Dubois", firstName: "Sophie", lastName: "Dubois", serviceKey: "cardio",
    title: "Cardiologue", bio: "Spécialiste du suivi de l'insuffisance cardiaque.",
    phone: "+225 07 00 01 02 05", category: "specialiste", schedule: SPECIALIST_SCHEDULE, color: "rose",
  },
  {
    name: "Dr Antoine Girard", firstName: "Antoine", lastName: "Girard", serviceKey: "cardio",
    title: "Professeur de Cardiologie", bio: "Expert en rythmologie et dépistage précoce.",
    phone: "+225 07 00 01 02 06", category: "professeur", schedule: FULL_WEEK_SCHEDULE, color: "red",
  },
  // Dermatologie
  {
    name: "Dr Léa Fontaine", firstName: "Léa", lastName: "Fontaine", serviceKey: "derma",
    title: "Dermatologue", bio: "Passionnée de dermatologie esthétique.",
    phone: "+225 07 00 01 02 07", category: "specialiste", schedule: SPECIALIST_SCHEDULE, color: "amber",
  },
  {
    name: "Dr Marc Chevallier", firstName: "Marc", lastName: "Chevallier", serviceKey: "derma",
    title: "Dermatologue", bio: "Praticien hospitalier, spécialiste des affections chroniques.",
    phone: "+225 07 00 01 02 08", category: "specialiste", schedule: MORNINGS_ONLY_SCHEDULE, color: "orange",
  },
  // Pédiatrie
  {
    name: "Dr Chloé Bernard", firstName: "Chloé", lastName: "Bernard", serviceKey: "pediatrie",
    title: "Pédiatre", bio: "À l'écoute des tout-petits et de leurs parents.",
    phone: "+225 07 00 01 02 09", category: "specialiste", schedule: FULL_WEEK_SCHEDULE, color: "violet",
  },
  {
    name: "Dr Nicolas Perrin", firstName: "Nicolas", lastName: "Perrin", serviceKey: "pediatrie",
    title: "Pédiatre", bio: "Ancien chef de clinique, vaccination et suivi de croissance.",
    phone: "+225 07 00 01 02 10", category: "specialiste", schedule: MORNINGS_ONLY_SCHEDULE, color: "purple",
  },
  // Dentisterie
  {
    name: "Dr Emma Rousseau", firstName: "Emma", lastName: "Rousseau", serviceKey: "dentaire",
    title: "Chirurgien-dentiste", bio: "Soins conservateurs et prévention, sans douleur.",
    phone: "+225 07 00 01 02 11", category: "specialiste", schedule: FULL_WEEK_SCHEDULE, color: "sky",
  },
  {
    name: "Dr Hugo Marchand", firstName: "Hugo", lastName: "Marchand", serviceKey: "dentaire",
    title: "Chirurgien-dentiste", bio: "Implantologie et soins du quotidien pour toute la famille.",
    phone: "+225 07 00 01 02 12", category: "specialiste", schedule: SPECIALIST_SCHEDULE, color: "cyan",
  },
  // Ophtalmologie
  {
    name: "Dr Inès Lambert", firstName: "Inès", lastName: "Lambert", serviceKey: "ophtalmo",
    title: "Ophtalmologue", bio: "Dépistage du glaucome et suivi de la myopie.",
    phone: "+225 07 00 01 02 13", category: "specialiste", schedule: FULL_WEEK_SCHEDULE, color: "indigo",
  },
  {
    name: "Dr Paul Garnier", firstName: "Paul", lastName: "Garnier", serviceKey: "ophtalmo",
    title: "Ophtalmologue", bio: "Chirurgie de la cataracte et basse vision.",
    phone: "+225 07 00 01 02 14", category: "specialiste", schedule: MORNINGS_ONLY_SCHEDULE, color: "blue",
  },
];

/**
 * Idempotent seeding: inserts the services and doctors above if the services
 * table is empty. Called once from the dashboard on mount.
 */
export const ensureSeedData = mutation({
  args: {},
  handler: async (ctx) => {
    // Clinic settings: seed the shared staff password (test default).
    const staffPassword = await ctx.db
      .query("clinicSettings")
      .withIndex("by_key", (q) => q.eq("key", STAFF_PASSWORD_KEY))
      .unique();
    if (!staffPassword) {
      await ctx.db.insert("clinicSettings", {
        key: STAFF_PASSWORD_KEY,
        value: STAFF_PASSWORD_DEFAULT,
      });
    }

    // Clinic settings: seed the default pricing grid — never overwrites a
    // grid the administration has already customized.
    const pricingGridRow = await ctx.db
      .query("clinicSettings")
      .withIndex("by_key", (q) => q.eq("key", PRICING_GRID_KEY))
      .unique();
    if (!pricingGridRow) {
      await ctx.db.insert("clinicSettings", {
        key: PRICING_GRID_KEY,
        value: JSON.stringify(DEFAULT_PRICING_GRID),
      });
    }

    // Demo: seed one declared day off (next Friday) so the staff can see
    // how congés block the doctor's slots. Idempotent on an empty table.
    const offDays = await ctx.db.query("doctorOffDays").collect();
    if (offDays.length === 0) {
      const doctors = await ctx.db.query("doctors").collect();
      const dubois = doctors.find((d) => d.name === "Dr Sophie Dubois");
      if (dubois) {
        const now = new Date();
        const daysUntilFriday = ((5 - now.getDay() + 7) % 7) || 7;
        const friday = new Date(now);
        friday.setDate(now.getDate() + daysUntilFriday);
        const key = toDateKey(friday);
        await ctx.db.insert("doctorOffDays", {
          doctorId: dubois._id,
          startDate: key,
          endDate: key,
          reason: "Formation médicale",
        });
      }
    }

    const existing = await ctx.db.query("services").collect();
    if (existing.length > 0) {
      // One-time currency migration: early demo data stored prices on an
      // euro scale (all below 1000). Switch them to the FCFA price list.
      if (existing.every((s) => s.price < 1000)) {
        for (const s of existing) {
          const seed = SEED_SERVICES.find((x) => x.name === s.name);
          if (seed && seed.price !== s.price) {
            await ctx.db.patch(s._id, { price: seed.price });
          }
        }
      }
      // isGeneralist migration: backfill on services seeded before this
      // field existed (matches Task 6's SEED_SERVICES flag by name) — without
      // this, a "Médecine générale" service inserted pre-feature would keep
      // isGeneralist undefined forever, misclassifying every généraliste
      // doctor as spécialiste for pricing-grid purposes.
      for (const s of existing) {
        const seed = SEED_SERVICES.find((x) => x.name === s.name);
        if (seed?.isGeneralist && s.isGeneralist == null) {
          await ctx.db.patch(s._id, { isGeneralist: true });
        }
      }

      // Doctor fiche migration: fill contact info + working hours on
      // doctors created before the fiche existed.
      const doctors = await ctx.db.query("doctors").collect();
      for (const d of doctors) {
        const seed = SEED_DOCTORS.find((x) => x.name === d.name);
        if (!seed) continue;
        const patch: Partial<{
          firstName: string;
          lastName: string;
          phone: string;
          schedule: SeedSchedule[];
        }> = {};
        if (!d.firstName && !d.lastName) {
          patch.firstName = seed.firstName;
          patch.lastName = seed.lastName;
        }
        if (!d.phone) patch.phone = seed.phone;
        if (!d.schedule || d.schedule.length === 0) {
          patch.schedule = seed.schedule;
        }
        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(d._id, patch);
        }
      }
      return { seeded: false, serviceCount: existing.length };
    }

    const serviceIds: Record<string, Id<"services">> = {};
    for (const s of SEED_SERVICES) {
      const { key, ...fields } = s;
      const id = await ctx.db.insert("services", fields);
      serviceIds[key] = id;
    }

    for (const d of SEED_DOCTORS) {
      const { serviceKey, ...fields } = d;
      await ctx.db.insert("doctors", {
        ...fields,
        serviceId: serviceIds[serviceKey],
      });
    }

    return {
      seeded: true,
      serviceCount: SEED_SERVICES.length,
      doctorCount: SEED_DOCTORS.length,
    };
  },
});
