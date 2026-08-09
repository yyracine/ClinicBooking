import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  MutationCtx,
  QueryCtx,
  mutation,
  query,
} from "./_generated/server";
import { nextDossierNumber } from "../lib/booking";

/**
 * Patient record cards (fiche patient) and medical files (dossier médical).
 */

type Ctx = QueryCtx | MutationCtx;

async function requireUser(ctx: Ctx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Vous devez être connecté pour effectuer cette action.");
  }
  return userId;
}

async function requireStaff(ctx: Ctx) {
  const userId = await requireUser(ctx);
  const user = await ctx.db.get<"users">(userId);
  if (user?.role !== "staff") {
    throw new Error("Accès réservé à l'administration de la clinique.");
  }
  return userId;
}

async function profileForUser(ctx: Ctx, userId: Id<"users">) {
  return ctx.db
    .query("patientProfiles")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

/** The signed-in patient's record card, or null. */
export const myProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    return (await profileForUser(ctx, userId)) ?? null;
  },
});

/**
 * Decorate visit rows with the doctor and the attached documents (with
 * signed URLs). Shared by the patient and staff views of the dossier.
 */
async function decorateVisits(ctx: Ctx, rows: VisitDoc[]) {
  return Promise.all(
    rows.map(async (visit) => {
      const [doctor, files] = await Promise.all([
        ctx.db.get(visit.doctorId),
        ctx.db
          .query("medicalFiles")
          .withIndex("by_visit", (q) => q.eq("visitId", visit._id))
          .collect(),
      ]);
      return {
        _id: visit._id,
        visitDate: visit.visitDate,
        report: visit.report,
        diagnosis: visit.diagnosis,
        advice: visit.advice,
        followUpDate: visit.followUpDate,
        medications: visit.medications,
        exams: visit.exams,
        weight: visit.weight,
        height: visit.height,
        bloodPressure: visit.bloodPressure,
        temperature: visit.temperature,
        doctor: doctor
          ? { name: doctor.name, title: doctor.title, color: doctor.color }
          : null,
        files: await Promise.all(
          files.map(async (f) => ({
            _id: f._id,
            name: f.name,
            size: f.size,
            mimeType: f.mimeType,
            url: await ctx.storage.getUrl(f.storageId),
          })),
        ),
      };
    }),
  );
}

type VisitDoc = {
  _id: Id<"visits">;
  doctorId: Id<"doctors">;
  visitDate: string;
  report: string;
  diagnosis?: string;
  advice?: string;
  followUpDate?: string;
  medications: { name: string; dosage: string }[];
  exams: {
    name: string;
    status: "prescribed" | "done";
    comment?: string;
  }[];
  weight?: number;
  height?: number;
  bloodPressure?: string;
  temperature?: number;
};

/** The signed-in patient's visits, most recent first. */
export const myVisits = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const rows = await ctx.db
      .query("visits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const items = await decorateVisits(ctx, rows);

    return items.sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  },
});

/** Create the patient's record card. One per account. */
export const createProfile = mutation({
  args: {
    email: v.optional(v.string()),
    lastName: v.string(),
    firstName: v.string(),
    birthDate: v.string(),
    phone: v.string(),
    emergencyName: v.optional(v.string()),
    emergencyPhone: v.optional(v.string()),
    address: v.string(),
    city: v.string(),
    postalCode: v.optional(v.string()),
    notes: v.optional(v.string()),
    allergies: v.optional(v.array(v.string())),
    antecedents: v.optional(v.array(v.string())),
    bloodGroup: v.optional(v.string()),
    familyHistory: v.optional(v.array(v.string())),
    surgicalHistory: v.optional(v.array(v.string())),
    currentTreatments: v.optional(v.array(v.string())),
    insured: v.boolean(),
    insuranceName: v.optional(v.string()),
    reimbursement100: v.optional(v.boolean()),
    tiersPayant: v.optional(v.boolean()),
    reimbursementRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const existing = await profileForUser(ctx, userId);
    if (existing) {
      throw new Error("Une fiche patient existe déjà pour ce compte.");
    }

    // One fiche patient per e-mail: refuse a duplicate so two people can
    // never end up with the same address.
    const user = await ctx.db.get<"users">(userId);
    const email = args.email?.trim() || user?.email || undefined;
    if (email) {
      const lower = email.toLocaleLowerCase("fr");
      const profiles = await ctx.db.query("patientProfiles").collect();
      const duplicate = profiles.find(
        (p) =>
          p.userId !== userId &&
          (p.email ?? "").toLocaleLowerCase("fr") === lower,
      );
      if (duplicate) {
        throw new Error(
          "Une fiche patient existe déjà pour cette adresse e-mail.",
        );
      }
    }

    const allProfiles = await ctx.db.query("patientProfiles").collect();
    const dossierNumber = nextDossierNumber(
      allProfiles.map((p) => p.dossierNumber),
    );

    const insurance = args.insured
      ? {
          insuranceName: args.insuranceName?.trim() || undefined,
          reimbursement100: args.reimbursement100,
          tiersPayant: args.tiersPayant,
          reimbursementRate: args.reimbursementRate,
        }
      : {
          insuranceName: undefined,
          reimbursement100: undefined,
          tiersPayant: undefined,
          reimbursementRate: undefined,
        };

    // If the account has no email yet (guest), adopt the one from the form.
    if (email && !user?.email) {
      await ctx.db.patch(userId, { email });
    }

    return await ctx.db.insert("patientProfiles", {
      userId,
      dossierNumber,
      email,
      lastName: args.lastName.trim(),
      firstName: args.firstName.trim(),
      birthDate: args.birthDate,
      phone: args.phone.trim(),
      emergencyName: args.emergencyName?.trim() || undefined,
      emergencyPhone: args.emergencyPhone?.trim() || undefined,
      address: args.address.trim(),
      city: args.city.trim(),
      postalCode: args.postalCode?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      allergies: cleanList(args.allergies),
      antecedents: cleanList(args.antecedents),
      bloodGroup: args.bloodGroup?.trim() || undefined,
      familyHistory: cleanList(args.familyHistory),
      surgicalHistory: cleanList(args.surgicalHistory),
      currentTreatments: cleanList(args.currentTreatments),
      insured: args.insured,
      ...insurance,
    });
  },
});

/** Trim and drop empty entries from a string list (allergies, antécédents). */
function cleanList(items: string[] | undefined): string[] | undefined {
  if (!items) return undefined;
  const clean = items
    .map((i) => i.trim())
    .filter((i) => i.length > 0);
  return clean.length > 0 ? clean : undefined;
}

/** Update the editable fields of the patient's own record card. */
export const updateProfile = mutation({
  args: {
    email: v.optional(v.string()),
    phone: v.string(),
    emergencyName: v.optional(v.string()),
    emergencyPhone: v.optional(v.string()),
    address: v.string(),
    city: v.string(),
    postalCode: v.optional(v.string()),
    notes: v.optional(v.string()),
    allergies: v.optional(v.array(v.string())),
    antecedents: v.optional(v.array(v.string())),
    bloodGroup: v.optional(v.string()),
    familyHistory: v.optional(v.array(v.string())),
    surgicalHistory: v.optional(v.array(v.string())),
    currentTreatments: v.optional(v.array(v.string())),
    insured: v.boolean(),
    insuranceName: v.optional(v.string()),
    reimbursement100: v.optional(v.boolean()),
    tiersPayant: v.optional(v.boolean()),
    reimbursementRate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const profile = await profileForUser(ctx, userId);
    if (!profile) {
      throw new Error("Aucune fiche patient pour ce compte.");
    }

    const insurance = args.insured
      ? {
          insuranceName: args.insuranceName?.trim() || undefined,
          reimbursement100: args.reimbursement100,
          tiersPayant: args.tiersPayant,
          reimbursementRate: args.reimbursementRate,
        }
      : {
          insuranceName: undefined,
          reimbursement100: undefined,
          tiersPayant: undefined,
          reimbursementRate: undefined,
        };

    const email = args.email?.trim() || undefined;
    if (email) {
      // One fiche patient per e-mail: refuse a duplicate so two people can
      // never end up with the same address (same rule as `createProfile`).
      const lower = email.toLocaleLowerCase("fr");
      const profiles = await ctx.db.query("patientProfiles").collect();
      const duplicate = profiles.find(
        (p) =>
          p.userId !== userId &&
          (p.email ?? "").toLocaleLowerCase("fr") === lower,
      );
      if (duplicate) {
        throw new Error(
          "Une fiche patient existe déjà pour cette adresse e-mail.",
        );
      }
      await ctx.db.patch(profile._id, { email });
    }

    await ctx.db.patch(profile._id, {
      phone: args.phone.trim(),
      emergencyName: args.emergencyName?.trim() || undefined,
      emergencyPhone: args.emergencyPhone?.trim() || undefined,
      address: args.address.trim(),
      city: args.city.trim(),
      postalCode: args.postalCode?.trim() || undefined,
      notes: args.notes?.trim() || undefined,
      allergies: cleanList(args.allergies),
      antecedents: cleanList(args.antecedents),
      bloodGroup: args.bloodGroup?.trim() || undefined,
      familyHistory: cleanList(args.familyHistory),
      surgicalHistory: cleanList(args.surgicalHistory),
      currentTreatments: cleanList(args.currentTreatments),
      insured: args.insured,
      ...insurance,
    });
  },
});

/**
 * Staff: update the medical info of a patient (allergies, antécédents,
 * groupe sanguin, antécédents familiaux / chirurgicaux, traitements).
 */
export const updateMedicalInfo = mutation({
  args: {
    userId: v.id("users"),
    allergies: v.optional(v.array(v.string())),
    antecedents: v.optional(v.array(v.string())),
    bloodGroup: v.optional(v.string()),
    familyHistory: v.optional(v.array(v.string())),
    surgicalHistory: v.optional(v.array(v.string())),
    currentTreatments: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const profile = await profileForUser(ctx, args.userId);
    if (!profile) {
      throw new Error("Ce patient n'a pas encore de fiche patient.");
    }
    const patch: {
      allergies?: string[];
      antecedents?: string[];
      bloodGroup?: string;
      familyHistory?: string[];
      surgicalHistory?: string[];
      currentTreatments?: string[];
    } = {};
    if (args.allergies !== undefined) {
      patch.allergies = cleanList(args.allergies);
    }
    if (args.antecedents !== undefined) {
      patch.antecedents = cleanList(args.antecedents);
    }
    if (args.bloodGroup !== undefined) {
      patch.bloodGroup = args.bloodGroup.trim() || undefined;
    }
    if (args.familyHistory !== undefined) {
      patch.familyHistory = cleanList(args.familyHistory);
    }
    if (args.surgicalHistory !== undefined) {
      patch.surgicalHistory = cleanList(args.surgicalHistory);
    }
    if (args.currentTreatments !== undefined) {
      patch.currentTreatments = cleanList(args.currentTreatments);
    }
    await ctx.db.patch(profile._id, patch);
  },
});

/** Staff: search patients by name or dossier number. */
export const searchPatients = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const profiles = await ctx.db.query("patientProfiles").collect();
    const q = args.query.trim().toLocaleLowerCase("fr");

    const results = profiles
      .filter((p) => {
        if (!q) return true;
        return [p.lastName, p.firstName, `${p.firstName} ${p.lastName}`, p.dossierNumber]
          .some((s) => s.toLocaleLowerCase("fr").includes(q));
      })
      .map((p) => ({
        _id: p._id,
        userId: p.userId,
        dossierNumber: p.dossierNumber,
        email: p.email,
        lastName: p.lastName,
        firstName: p.firstName,
        birthDate: p.birthDate,
        phone: p.phone,
        city: p.city,
      }))
      .sort((a, b) => a.lastName.localeCompare(b.lastName, "fr"));

    return results;
  },
});

/** Staff: the full medical file of a patient (record card + visits). */
export const getPatientRecord = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const profile = await profileForUser(ctx, args.userId);
    if (!profile) return null;

    const rows = await ctx.db
      .query("visits")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const visits = await decorateVisits(ctx, rows);

    return {
      profile,
      visits: visits.sort((a, b) => b.visitDate.localeCompare(a.visitDate)),
    };
  },
});

/**
 * Link an existing record card to the signed-in account.
 *
 * Convex Auth can create several accounts for the same e-mail (one per
 * provider: password, OTP…). When a patient signs in with a new provider and
 * their fiche patient already exists under another account with the same
 * e-mail, claim it so they never have to fill the form twice.
 *
 * Only e-mail is used for matching: to sign in as the current account the
 * person must control that e-mail (mot de passe ou code), so a real
 * (non-anonymous) account with the matching e-mail can claim the fiche.
 */
export const claimProfileByEmail = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);

    const me = await ctx.db.get<"users">(userId);
    const accountEmail = (me?.email ?? "").toLocaleLowerCase("fr");
    if (!accountEmail) return { claimed: false, reason: "no-email" };

    // Already has a fiche on this account: nothing to do.
    const mine = await profileForUser(ctx, userId);
    if (mine) return { claimed: false, reason: "already" };

    // Find a fiche with the same e-mail on another account. Only claim it
    // from an account that cannot prove ownership as well as the current one
    // (anonymous, or e-mail not verified). This keeps the fiche stable when
    // the same person has several accounts for one e-mail.
    const profiles = await ctx.db.query("patientProfiles").collect();
    const orphan = profiles.find((p) => {
      if (p.userId === userId) return false;
      if ((p.email ?? "").toLocaleLowerCase("fr") !== accountEmail) {
        return false;
      }
      return true;
    });
    if (!orphan) return { claimed: false, reason: "not-found" };

    // To sign in as this account, the person proved control of the e-mail
    // (mot de passe ou code). Any real account carrying that e-mail may claim
    // the fiche, so a patient finds their dossier whatever method they use.
    const canClaim = me?.isAnonymous !== true && Boolean(me?.email);
    if (!canClaim) return { claimed: false, reason: "verified-owner" };

    await ctx.db.patch(orphan._id, { userId });

    // Move the medical file and appointments along with the fiche.
    const visits = await ctx.db
      .query("visits")
      .withIndex("by_user", (q) => q.eq("userId", orphan.userId))
      .collect();
    for (const visit of visits) {
      await ctx.db.patch(visit._id, { userId });
    }
    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_user", (q) => q.eq("userId", orphan.userId))
      .collect();
    for (const appointment of appointments) {
      await ctx.db.patch(appointment._id, { userId });
    }

    return { claimed: true };
  },
});

/** Staff: record a consultation report in a patient's medical file. */
export const addVisit = mutation({
  args: {
    userId: v.id("users"),
    doctorId: v.id("doctors"),
    visitDate: v.string(),
    report: v.string(),
    medications: v.array(
      v.object({ name: v.string(), dosage: v.string() }),
    ),
    exams: v.array(
      v.object({
        name: v.string(),
        status: v.union(v.literal("prescribed"), v.literal("done")),
        comment: v.optional(v.string()),
      }),
    ),
    // Vital signs measured during the visit (all optional).
    weight: v.optional(v.number()), // kg
    height: v.optional(v.number()), // cm
    bloodPressure: v.optional(v.string()), // ex. "12/8"
    temperature: v.optional(v.number()), // °C
    // Dossier enrichi : diagnostic, conseils, prochaine consultation.
    diagnosis: v.optional(v.string()),
    advice: v.optional(v.string()),
    followUpDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const profile = await profileForUser(ctx, args.userId);
    if (!profile) {
      throw new Error("Ce patient n'a pas encore de fiche patient.");
    }

    return await ctx.db.insert("visits", {
      userId: args.userId,
      doctorId: args.doctorId,
      visitDate: args.visitDate,
      report: args.report.trim(),
      diagnosis: args.diagnosis?.trim() || undefined,
      advice: args.advice?.trim() || undefined,
      followUpDate: args.followUpDate?.trim() || undefined,
      medications: args.medications
        .map((m) => ({ name: m.name.trim(), dosage: m.dosage.trim() }))
        .filter((m) => m.name),
      exams: args.exams
        .map((e) => ({
          name: e.name.trim(),
          status: e.status,
          comment: e.comment?.trim() || undefined,
        }))
        .filter((e) => e.name),
      weight: args.weight,
      height: args.height,
      bloodPressure: args.bloodPressure?.trim() || undefined,
      temperature: args.temperature,
    });
  },
});

/* ------------------------------------------------------------------ */
/* Attachments (pièces jointes) of a visit — Convex file storage        */
/* ------------------------------------------------------------------ */

/** Staff: get a signed upload URL to upload a document. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Staff: attach an uploaded file to a visit of the medical file. */
export const attachVisitFile = mutation({
  args: {
    visitId: v.id("visits"),
    storageId: v.string(),
    name: v.string(),
    mimeType: v.optional(v.string()),
    size: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const visit = await ctx.db.get(args.visitId);
    if (!visit) throw new Error("Visite introuvable.");
    return await ctx.db.insert("medicalFiles", {
      userId: visit.userId,
      visitId: args.visitId,
      storageId: args.storageId,
      name: args.name.trim() || "document",
      mimeType: args.mimeType,
      size: args.size,
    });
  },
});

/** Staff: remove an attached document from a visit. */
export const deleteVisitFile = mutation({
  args: { fileId: v.id("medicalFiles") },
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("Document introuvable.");
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(args.fileId);
  },
});
