import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";
import { computeAvailableSlots } from "./catalog";
import { logActivity } from "./log";
import { findWaitingEntry, isPastDateKey, isValidDateKey, pickNextWaiting, sortWaitingFifo } from "../lib/booking";

/**
 * Waiting list (liste d'attente) : a patient who finds no free slot for a
 * doctor on a date can join the waiting list. When an appointment is
 * cancelled, the first patient in line is notified by e-mail of the freed
 * slot (see `appointments.ts`), and the staff can assign the slot directly.
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
  if (user?.role !== "staff" || user?.disabled === true) {
    throw new Error("Accès réservé à l'administration de la clinique.");
  }
  return userId;
}

/** The signed-in patient's waiting-list entries, with doctor details. */
export const myWaitingList = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const rows = await ctx.db
      .query("waitingList")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const items = await Promise.all(
      rows.map(async (w) => {
        const doctor = await ctx.db.get(w.doctorId);
        const service = doctor ? await ctx.db.get(doctor.serviceId) : null;
        return {
          _id: w._id,
          doctorId: w.doctorId,
          date: w.date,
          createdAt: w._creationTime,
          doctor: doctor
            ? { name: doctor.name, title: doctor.title, color: doctor.color }
            : null,
          service: service ? { name: service.name } : null,
        };
      }),
    );

    return items.sort((a, b) => b.date.localeCompare(a.date));
  },
});

/** Staff: the patients waiting for a doctor on a date, oldest first. */
export const waitingListFor = query({
  args: { doctorId: v.id("doctors"), date: v.string() },
  handler: async (ctx, args) => {
    await requireStaff(ctx);

    const rows = await ctx.db
      .query("waitingList")
      .withIndex("by_doctor_date", (q) =>
        q.eq("doctorId", args.doctorId).eq("date", args.date),
      )
      .collect();

    return Promise.all(
      sortWaitingFifo(rows).map(async (w) => {
          const user = await ctx.db.get<"users">(w.userId);
          const profile = await ctx.db
            .query("patientProfiles")
            .withIndex("by_user", (q) => q.eq("userId", w.userId))
            .first();
          return {
            _id: w._id,
            userId: w.userId,
            createdAt: w._creationTime,
            name: profile
              ? `${profile.firstName} ${profile.lastName}`
              : user?.name ?? "Patient",
            email: profile?.email ?? user?.email ?? null,
            phone: profile?.phone ?? null,
          };
        }),
    );
  },
});

/** Staff: every waiting-list entry, oldest first, with patient + doctor. */
export const staffWaitingList = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);

    const rows = await ctx.db.query("waitingList").collect();
    const sorted = sortWaitingFifo(rows);

    const items = await Promise.all(
      sorted.map(async (w) => {
        const [doctor, user, profile] = await Promise.all([
          ctx.db.get(w.doctorId),
          ctx.db.get<"users">(w.userId),
          ctx.db
            .query("patientProfiles")
            .withIndex("by_user", (q) => q.eq("userId", w.userId))
            .first(),
        ]);
        return {
          _id: w._id,
          userId: w.userId,
          doctorId: w.doctorId,
          date: w.date,
          createdAt: w._creationTime,
          name: profile
            ? `${profile.firstName} ${profile.lastName}`
            : user?.name ?? "Patient",
          phone: profile?.phone ?? null,
          doctorName: doctor?.name ?? "",
          doctorTitle: doctor?.title ?? "",
          doctorColor: doctor?.color ?? "teal",
          serviceName: doctor
            ? (await ctx.db.get(doctor.serviceId))?.name ?? ""
            : "",
        };
      }),
    );

    return items;
  },
});

/** Patient: join the waiting list for a doctor on a date. */
export const joinWaitingList = mutation({
  args: { doctorId: v.id("doctors"), date: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor) throw new Error("Médecin introuvable.");
    if (!isValidDateKey(args.date)) {
      throw new Error("Date invalide.");
    }
    if (isPastDateKey(args.date)) {
      throw new Error("Impossible de s'inscrire pour une date passée.");
    }

    // No-duplicate rule: one entry per (doctor, date) per patient. The
    // matching predicate is shared with `leaveWaitingList` and unit-tested
    // in src/lib/booking.test.ts.
    const candidates = await ctx.db
      .query("waitingList")
      .withIndex("by_doctor_date", (q) =>
        q.eq("doctorId", args.doctorId).eq("date", args.date),
      )
      .collect();
    if (findWaitingEntry(candidates, args.doctorId, args.date, userId)) {
      throw new Error("Vous êtes déjà inscrit·e pour ce créneau.");
    }

    const id = await ctx.db.insert("waitingList", {
      doctorId: args.doctorId,
      date: args.date,
      userId,
    });

    await logActivity(ctx, {
      actorId: userId,
      action: "waiting.join",
      label: "Inscription en liste d'attente",
      details: `${doctor.name} — ${args.date}`,
    });

    return id;
  },
});

/** Patient: remove their own entry from the waiting list. */
export const leaveWaitingList = mutation({
  args: { doctorId: v.id("doctors"), date: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const candidates = await ctx.db
      .query("waitingList")
      .withIndex("by_doctor_date", (q) =>
        q.eq("doctorId", args.doctorId).eq("date", args.date),
      )
      .collect();
    const entry = findWaitingEntry(candidates, args.doctorId, args.date, userId);
    if (!entry) return;

    await ctx.db.delete(entry._id);
    await logActivity(ctx, {
      actorId: userId,
      action: "waiting.leave",
      label: "Retrait de la liste d'attente",
      details: `${args.doctorId} — ${args.date}`,
    });
  },
});

/**
 * Staff: assign the first waiting patient to a freed slot of the day. The
 * appointment is created (status "pending") and the patient is e-mailed.
 */
export const assignWaitingSlot = mutation({
  args: {
    doctorId: v.id("doctors"),
    date: v.string(),
    time: v.string(),
  },
  handler: async (ctx, args) => {
    const staffId = await requireStaff(ctx);

    const entries = await ctx.db
      .query("waitingList")
      .withIndex("by_doctor_date", (q) =>
        q.eq("doctorId", args.doctorId).eq("date", args.date),
      )
      .collect();
    if (entries.length === 0) {
      throw new Error("Personne en liste d'attente pour ce créneau.");
    }
    const entry = pickNextWaiting(entries)!;

    const slots = await computeAvailableSlots(ctx, args.doctorId, args.date);
    if (!slots.includes(args.time)) {
      throw new Error("Ce créneau n'est plus disponible.");
    }

    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor) throw new Error("Médecin introuvable.");

    const appointmentId = await ctx.db.insert("appointments", {
      userId: entry.userId,
      serviceId: doctor.serviceId,
      doctorId: args.doctorId,
      date: args.date,
      time: args.time,
      status: "pending",
    });
    await ctx.db.delete(entry._id);

    // Confirmation e-mail for the reassigned patient.
    const [service, patient, profile] = await Promise.all([
      ctx.db.get(doctor.serviceId),
      ctx.db.get<"users">(entry.userId),
      ctx.db
        .query("patientProfiles")
        .withIndex("by_user", (q) => q.eq("userId", entry.userId))
        .first(),
    ]);
    const email = profile?.email ?? patient?.email;
    if (email) {
      await ctx.scheduler.runAfter(0, api.emails.sendAppointmentConfirmation, {
        userId: entry.userId,
        to: email,
        phone: profile?.phone ?? undefined,
        patientName: profile
          ? `${profile.firstName} ${profile.lastName}`
          : patient?.name ?? "Patient",
        serviceName: service?.name ?? "",
        doctorName: doctor.name,
        doctorTitle: doctor.title,
        date: args.date,
        time: args.time,
      });
    }

    await logActivity(ctx, {
      actorId: staffId,
      action: "waiting.assign",
      label: "Créneau attribué à un patient en attente",
      details: `${doctor.name} — ${args.date} ${args.time}`,
    });

    return appointmentId;
  },
});
