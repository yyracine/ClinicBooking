import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { computeAvailableSlots } from "./catalog";
import { appointmentStatusValidator } from "./schema";
import { Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";
import { logActivity } from "./log";
import { computePatientShare, resolveConsultationPrice } from "../lib/pricing";
import { getPricingGrid } from "./settings";
import {
  canCancelFree,
  isPastDateKey,
  isValidDateKey,
  nextDossierNumber,
  pickNextWaiting,
  reminderScheduleTimes,
} from "../lib/booking";
import { sortAppointments } from "../lib/csv";

/**
 * Appointments: booking, cancelling, and the staff planning view.
 */

const STAFF_ROLE = "staff";

type AppCtx = QueryCtx | MutationCtx;

async function requireUser(ctx: AppCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Vous devez être connecté pour effectuer cette action.");
  }
  return userId;
}

async function isStaff(ctx: AppCtx, userId: Id<"users">) {
  const user = await ctx.db.get<"users">(userId);
  return user?.role === STAFF_ROLE && user?.disabled !== true;
}

/**
 * When an appointment is cancelled, notify the first patient of the waiting
 * list for the same doctor + date that a slot just freed up (e-mail).
 */
async function notifyWaitingList(
  ctx: MutationCtx,
  appointment: {
    doctorId: Id<"doctors">;
    serviceId: Id<"services">;
    date: string;
    time: string;
  },
) {
  const waiting = await ctx.db
    .query("waitingList")
    .withIndex("by_doctor_date", (q) =>
      q.eq("doctorId", appointment.doctorId).eq("date", appointment.date),
    )
    .collect();
  if (waiting.length === 0) return;

  const [doctor, service, first] = await Promise.all([
    ctx.db.get(appointment.doctorId),
    ctx.db.get(appointment.serviceId),
    (async () => {
      const firstEntry = pickNextWaiting(waiting);
      if (!firstEntry) return { userId: null, email: null, phone: null, name: "" };
      const user = await ctx.db.get<"users">(firstEntry.userId);
      const profile = await ctx.db
        .query("patientProfiles")
        .withIndex("by_user", (q) => q.eq("userId", firstEntry.userId))
        .first();
      return {
        userId: firstEntry.userId,
        email: profile?.email ?? user?.email,
        phone: profile?.phone ?? null,
        name: profile
          ? `${profile.firstName} ${profile.lastName}`
          : user?.name ?? "Patient",
      };
    })(),
  ]);

  if (!first.userId) return;

  await ctx.scheduler.runAfter(0, api.emails.sendSlotAvailable, {
    userId: first.userId,
    to: first.email ?? "",
    phone: first.phone ?? undefined,
    patientName: first.name,
    serviceName: service?.name ?? "",
    doctorName: doctor?.name ?? "",
    doctorTitle: doctor?.title ?? "",
    date: appointment.date,
    time: appointment.time,
  });
}

/**
 * Insert an in-app notification for every staff account (used when a
 * patient books online, so the clinic team sees it in the planning).
 */
async function notifyAllStaff(
  ctx: MutationCtx,
  notice: { type: string; title: string; body: string },
) {
  const staff = await ctx.db.query("users").collect();
  await Promise.all(
    staff
      .filter((u) => u.role === "staff" && u.disabled !== true)
      .map((u) =>
        ctx.db.insert("notifications", {
          userId: u._id,
          type: notice.type,
          title: notice.title,
          body: notice.body,
          read: false,
        }),
      ),
  );
}

/** Appointments of the signed-in patient, with doctor + service details. */
export const myAppointments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const rows = await ctx.db
      .query("appointments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const items = await Promise.all(
      rows.map(async (a) => {
        const [doctor, service] = await Promise.all([
          ctx.db.get(a.doctorId),
          ctx.db.get(a.serviceId),
        ]);
        return {
          _id: a._id,
          date: a.date,
          time: a.time,
          status: a.status,
          notes: a.notes,
          amountPaid: a.amountPaid,
          paidAt: a.paidAt,
          doctor: doctor
            ? {
                name: doctor.name,
                title: doctor.title,
                color: doctor.color,
                category: doctor.category,
              }
            : null,
          service: service
            ? {
                name: service.name,
                durationMinutes: service.durationMinutes,
                price: service.price,
                icon: service.icon,
                color: service.color,
                isGeneralist: service.isGeneralist,
              }
            : null,
        };
      }),
    );

    return sortAppointments(items);
  },
});

/** Every appointment in the clinic, with patient info. Staff only. */
export const allAppointments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Non connecté.");

    const user = await ctx.db.get(userId);
    if (user?.role !== STAFF_ROLE) {
      throw new Error("Accès réservé à l'administration de la clinique.");
    }

    const rows = await ctx.db.query("appointments").collect();

    const items = await Promise.all(
      rows.map(async (a) => {
        const [doctor, service, patient, profile] = await Promise.all([
          ctx.db.get(a.doctorId),
          ctx.db.get(a.serviceId),
          ctx.db.get(a.userId),
          ctx.db
            .query("patientProfiles")
            .withIndex("by_user", (q) => q.eq("userId", a.userId))
            .first(),
        ]);
        return {
          _id: a._id,
          date: a.date,
          time: a.time,
          status: a.status,
          notes: a.notes,
          amountPaid: a.amountPaid,
          paidAt: a.paidAt,
          doctor: doctor
            ? {
                name: doctor.name,
                title: doctor.title,
                color: doctor.color,
                category: doctor.category,
              }
            : null,
          service: service
            ? {
                name: service.name,
                durationMinutes: service.durationMinutes,
                price: service.price,
                icon: service.icon,
                color: service.color,
                isGeneralist: service.isGeneralist,
              }
            : null,
          patient: {
            // The fiche patient carries the display name and contact e-mail:
            // accounts created by e-mail code (OTP) or guests have no
            // `users.name` set, so the planning would show a blank "Patient".
            name:
              (profile
                ? `${profile.firstName} ${profile.lastName}`
                : patient?.name) ?? null,
            email: profile?.email ?? patient?.email ?? null,
            phone: profile?.phone ?? null,
          },
          // Insurance data used to compute the amount to collect.
          insurance: profile
            ? {
                insured: profile.insured,
                insuranceName: profile.insuranceName,
                reimbursement100: profile.reimbursement100,
                tiersPayant: profile.tiersPayant,
                reimbursementRate: profile.reimbursementRate,
              }
            : null,
          // Allergy alert for the staff planning.
          hasAllergies: (profile?.allergies?.length ?? 0) > 0,
          allergies: profile?.allergies ?? [],
        };
      }),
    );

    return sortAppointments(items);
  },
});

/** Book an appointment. Re-validates availability server-side. */
export const bookAppointment = mutation({
  args: {
    serviceId: v.id("services"),
    doctorId: v.id("doctors"),
    date: v.string(),
    time: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Service introuvable.");

    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor || doctor.serviceId !== args.serviceId) {
      throw new Error("Praticien invalide pour ce service.");
    }

    if (!isValidDateKey(args.date)) {
      throw new Error("Date invalide.");
    }
    if (isPastDateKey(args.date)) {
      throw new Error("Impossible de réserver une date passée.");
    }

    const slots = await computeAvailableSlots(ctx, args.doctorId, args.date);
    if (!slots.includes(args.time)) {
      throw new Error(
        "Ce créneau vient d'être réservé. Merci d'en choisir un autre.",
      );
    }

    // Bookings start as "pending": the appointment is only confirmed once
    // the patient pays at the clinic.
    const id = await ctx.db.insert("appointments", {
      userId,
      serviceId: args.serviceId,
      doctorId: args.doctorId,
      date: args.date,
      time: args.time,
      status: "pending",
      notes: args.notes?.trim() ? args.notes.trim() : undefined,
    });

    await logActivity(ctx, {
      actorId: userId,
      action: "appointment.booked",
      label: "Rendez-vous réservé en ligne",
      details: `${doctor.name} — ${args.date} ${args.time}`,
    });

    // In-app notification for the clinic staff (visible in the planning).
    await notifyAllStaff(ctx, {
      type: "appointment.booked",
      title: "Nouveau rendez-vous en ligne",
      body: `Un patient a réservé ${args.date} à ${args.time} avec ${doctor.name} (${service.name}).`,
    });

    return id;
  },
});

/** Cancel an appointment: the owner patient or any staff member. */
export const cancelAppointment = mutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) throw new Error("Rendez-vous introuvable.");

    const staff = await isStaff(ctx, userId);
    if (appointment.userId !== userId && !staff) {
      throw new Error("Vous ne pouvez pas annuler ce rendez-vous.");
    }
    if (appointment.status === "cancelled") return;

    // Cancellation policy: a patient may cancel for free up to 24 h before
    // the appointment; after that, they must call the clinic (the staff can
    // always cancel).
    if (!staff && !canCancelFree(appointment.date, appointment.time)) {
      throw new Error(
        "L'annulation gratuite n'est possible que jusqu'à 24 h avant le rendez-vous. Pour annuler à cette date, contactez la clinique.",
      );
    }

    await ctx.db.patch(args.appointmentId, { status: "cancelled" });

    // In-app notification to the patient (whoever initiated the cancel).
    if (appointment.userId) {
      await ctx.db.insert("notifications", {
        userId: appointment.userId,
        type: "appointment.cancelled",
        title: "Rendez-vous annulé",
        body: `Votre rendez-vous du ${appointment.date} à ${appointment.time} a été annulé.`,
        read: false,
      });
    }

    // A slot just freed up: notify the first patient of the waiting list.
    await notifyWaitingList(ctx, appointment);

    await logActivity(ctx, {
      actorId: userId,
      action: "appointment.cancelled",
      label: staff
        ? "Rendez-vous annulé (administration)"
        : "Rendez-vous annulé (patient)",
      details: `${appointment.date} ${appointment.time}`,
    });
  },
});

/**
 * Internal query used by the scheduled reminders (J-7 / J-3 / J-1): returns
 * the data needed to notify the patient (e-mail, SMS, notification in-app),
 * or null when the appointment is no longer confirmed (cancelled,
 * completed…).
 *
 * Callable without a session so a scheduled action can use it; it only
 * exposes the summary of a single appointment whose id is unguessable.
 */
export const getReminderInfo = query({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment || appointment.status !== "confirmed") return null;

    const [doctor, service, patient, profile] = await Promise.all([
      ctx.db.get(appointment.doctorId),
      ctx.db.get(appointment.serviceId),
      ctx.db.get<"users">(appointment.userId),
      ctx.db
        .query("patientProfiles")
        .withIndex("by_user", (q) => q.eq("userId", appointment.userId))
        .first(),
    ]);

    const to = profile?.email ?? patient?.email;

    return {
      userId: appointment.userId,
      to: to ?? "",
      phone: profile?.phone ?? undefined,
      patientName: profile
        ? `${profile.firstName} ${profile.lastName}`
        : patient?.name ?? "Patient",
      serviceName: service?.name ?? "",
      doctorName: doctor?.name ?? "",
      doctorTitle: doctor?.title ?? "",
      date: appointment.date,
      time: appointment.time,
      notes: appointment.notes ?? undefined,
    };
  },
});

/**
 * Staff: validate the patient's payment at the clinic.
 * Computes the amount to collect from the service price and the patient's
 * insurance data, records it on the appointment and sets the status to
 * "confirmed".
 */
export const recordPayment = mutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (!(await isStaff(ctx, userId))) {
      throw new Error("Accès réservé à l'administration de la clinique.");
    }

    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) throw new Error("Rendez-vous introuvable.");
    if (appointment.status === "confirmed") {
      throw new Error("Ce rendez-vous est déjà confirmé.");
    }
    if (appointment.status === "completed") {
      throw new Error("Ce rendez-vous est déjà terminé.");
    }
    if (appointment.status === "cancelled") {
      throw new Error("Ce rendez-vous est annulé.");
    }

    const service = await ctx.db.get(appointment.serviceId);
    if (!service) throw new Error("Service introuvable.");

    // The price of the consultation follows the clinic's category pricing grid.
    const doctor = await ctx.db.get(appointment.doctorId);
    const grid = await getPricingGrid(ctx.db);
    const price = doctor
      ? resolveConsultationPrice(doctor, grid)
      : service.price;

    const profile = await ctx.db
      .query("patientProfiles")
      .withIndex("by_user", (q) => q.eq("userId", appointment.userId))
      .first();

    const amountPaid = computePatientShare(price, profile);

    await ctx.db.patch(args.appointmentId, {
      status: "confirmed",
      amountPaid,
      paidAt: Date.now(),
    });

    // Confirmation (e-mail + SMS + notification in-app): sent right after
    // the mutation commits (scheduler). Each channel degrades gracefully
    // when the patient has no e-mail or no phone — the in-app notification
    // is always created.
    const patient = await ctx.db.get<"users">(appointment.userId);
    const patientEmail = profile?.email ?? patient?.email;
    let emailScheduled = false;
    {
      await ctx.scheduler.runAfter(
        0,
        api.emails.sendAppointmentConfirmation,
        {
          userId: appointment.userId,
          to: patientEmail ?? "",
          phone: profile?.phone ?? undefined,
          patientName: profile
            ? `${profile.firstName} ${profile.lastName}`
            : patient?.name ?? "Patient",
          serviceName: service.name,
          doctorName: doctor?.name ?? "",
          doctorTitle: doctor?.title ?? "",
          date: appointment.date,
          time: appointment.time,
          notes: appointment.notes ?? undefined,
        },
      );
      emailScheduled = true;
    }

    // Rappels multiples (J-7, J-3, J-1): schedule each reminder still in the
    // future (see `reminderScheduleTimes` in lib/booking.ts, unit-tested).
    // The action re-checks the status at send time, so a cancelled
    // appointment never receives a reminder.
    let reminderScheduled = false;
    for (const { daysBefore, runAt } of reminderScheduleTimes(
      appointment.date,
      appointment.time,
    )) {
      await ctx.scheduler.runAt(
        runAt,
        api.emails.sendAppointmentReminder,
        { appointmentId: appointment._id, daysBefore },
      );
      reminderScheduled = true;
    }

    await logActivity(ctx, {
      actorId: userId,
      action: "payment.recorded",
      label: "Paiement validé — rendez-vous confirmé",
      details: `${service.name} — ${appointment.date} ${appointment.time} (${amountPaid.toLocaleString("fr-FR")} FCFA)`,
    });

    return { amountPaid, emailScheduled, reminderScheduled };
  },
});

/**
 * Staff: move an appointment between pending / completed / cancelled.
 * "Confirmed" can only be reached by validating the payment
 * (see `recordPayment`).
 */
export const updateAppointmentStatus = mutation({
  args: {
    appointmentId: v.id("appointments"),
    status: appointmentStatusValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    if (!(await isStaff(ctx, userId))) {
      throw new Error("Accès réservé à l'administration de la clinique.");
    }
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) throw new Error("Rendez-vous introuvable.");

    if (args.status === "confirmed") {
      throw new Error(
        "Le statut « Confirmé » s'obtient en validant le paiement.",
      );
    }

    if (args.status === "completed") {
      // A paid appointment marked "Terminé" keeps its payment: it was
      // already collected at the clinic (receipts and revenue stats rely on
      // amountPaid / paidAt remaining set).
      await ctx.db.patch(args.appointmentId, { status: args.status });
    } else {
      // Any other status change resets the recorded payment (e.g. a refund
      // when moving a confirmed appointment to pending or cancelled).
      await ctx.db.patch(args.appointmentId, {
        status: args.status,
        amountPaid: undefined,
        paidAt: undefined,
      });
    }

    // A slot may have freed up when moving to "cancelled".
    if (args.status === "cancelled") {
      await notifyWaitingList(ctx, appointment);
    }

    await logActivity(ctx, {
      actorId: userId,
      action: "appointment.status",
      label: `Statut du rendez-vous → ${args.status}`,
      details: `${appointment.date} ${appointment.time}`,
    });
  },
});

/**
 * Staff: book an appointment on behalf of a patient (phone / walk-in).
 * The patient can be an existing account or a brand-new one created here
 * with the minimal record-card fields.
 */
export const staffBookAppointment = mutation({
  args: {
    serviceId: v.id("services"),
    doctorId: v.id("doctors"),
    date: v.string(),
    time: v.string(),
    notes: v.optional(v.string()),
    // Either an existing patient account…
    existingPatientId: v.optional(v.id("users")),
    // …or a brand-new patient created with the minimal record-card fields.
    newPatient: v.optional(
      v.object({
        lastName: v.string(),
        firstName: v.string(),
        phone: v.string(),
        birthDate: v.string(),
        email: v.optional(v.string()),
        address: v.optional(v.string()),
        city: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const staffId = await requireUser(ctx);
    if (!(await isStaff(ctx, staffId))) {
      throw new Error("Accès réservé à l'administration de la clinique.");
    }

    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Service introuvable.");
    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor || doctor.serviceId !== args.serviceId) {
      throw new Error("Praticien invalide pour ce service.");
    }
    if (!isValidDateKey(args.date)) {
      throw new Error("Date invalide.");
    }
    if (isPastDateKey(args.date)) {
      throw new Error("Impossible de réserver une date passée.");
    }
    const slots = await computeAvailableSlots(ctx, args.doctorId, args.date);
    if (!slots.includes(args.time)) {
      throw new Error("Ce créneau n'est plus disponible.");
    }

    let userId: Id<"users">;
    let patientName: string;
    let patientEmail: string | undefined;

    if (args.existingPatientId) {
      const existingId = args.existingPatientId;
      const profile = await ctx.db
        .query("patientProfiles")
        .withIndex("by_user", (q) => q.eq("userId", existingId))
        .first();
      const user = await ctx.db.get<"users">(existingId);
      if (!profile && !user) throw new Error("Patient introuvable.");
      userId = existingId;
      patientName = profile
        ? `${profile.firstName} ${profile.lastName}`
        : user?.name ?? "Patient";
      patientEmail = profile?.email ?? user?.email ?? undefined;
    } else if (args.newPatient) {
      const fresh = args.newPatient;
      const { lastName, firstName, phone, birthDate } = fresh;
      if (!lastName.trim() || !firstName.trim() || !phone.trim() || !birthDate) {
        throw new Error(
          "Renseignez le nom, le prénom, le téléphone et la date de naissance du patient.",
        );
      }
      const email = fresh.email?.trim() || undefined;
      if (email) {
        const lower = email.toLocaleLowerCase("fr");
        const profiles = await ctx.db.query("patientProfiles").collect();
        const duplicate = profiles.find(
          (p) => (p.email ?? "").toLocaleLowerCase("fr") === lower,
        );
        if (duplicate) {
          throw new Error(
            "Une fiche patient existe déjà pour cette adresse e-mail.",
          );
        }
      }
      userId = await ctx.db.insert("users", {
        name: `${firstName.trim()} ${lastName.trim()}`,
        email,
        role: "patient",
      });
      const allProfiles = await ctx.db.query("patientProfiles").collect();
      await ctx.db.insert("patientProfiles", {
        userId,
        dossierNumber: nextDossierNumber(
          allProfiles.map((p) => p.dossierNumber),
        ),
        email,
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        birthDate,
        phone: phone.trim(),
        address: fresh.address?.trim() ?? "",
        city: fresh.city?.trim() ?? "",
        insured: false,
      });
      patientName = `${firstName.trim()} ${lastName.trim()}`;
      patientEmail = email;
    } else {
      throw new Error("Indiquez le patient (existant ou nouveau).");
    }

    const appointmentId = await ctx.db.insert("appointments", {
      userId,
      serviceId: args.serviceId,
      doctorId: args.doctorId,
      date: args.date,
      time: args.time,
      status: "pending",
      notes: args.notes?.trim() ? args.notes.trim() : undefined,
    });

    // Confirm (e-mail + SMS + notification in-app) — each channel degrades
    // gracefully when the patient has no e-mail or no phone.
    const patientProfile = await ctx.db
      .query("patientProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    {
      await ctx.scheduler.runAfter(0, api.emails.sendAppointmentConfirmation, {
        userId,
        to: patientEmail ?? "",
        phone: patientProfile?.phone ?? undefined,
        patientName,
        serviceName: service.name,
        doctorName: doctor.name,
        doctorTitle: doctor.title,
        date: args.date,
        time: args.time,
        notes: args.notes?.trim() || undefined,
      });
    }

    await logActivity(ctx, {
      actorId: staffId,
      action: "appointment.booked-by-staff",
      label: "Rendez-vous créé par l'administration",
      details: `${patientName} — ${args.date} ${args.time}`,
    });

    return { appointmentId, patientName };
  },
});

/** First connection: choose your profile (patient or clinic staff). */
export const setRole = mutation({
  args: {
    role: v.union(v.literal("patient"), v.literal("staff")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await ctx.db.patch(userId, { role: args.role });
  },
});
