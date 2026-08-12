import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { action, mutation, query } from "./_generated/server";
import { computePatientShare, resolveConsultationPrice } from "../lib/pricing";
import { getPricingGrid } from "./settings";
import { reminderScheduleTimes } from "../lib/booking";
import { logActivity } from "./log";

/**
 * Paiements mobiles (Orange Money / MTN MoMo / Wave) via l'agrégateur
 * CinetPay, et statut de configuration des intégrations externes.
 *
 * L'action `createMobilePaymentRequest` génère un lien de paiement que
 * l'équipe peut envoyer au patient par SMS / WhatsApp. Sans clé configurée
 * (`CINETPAY_API_KEY` / `CINETPAY_SITE_ID` dans l'onglet « Keys »), elle
 * fonctionne en **mode démo** : elle renvoie le même contrat de données avec
 * `demo: true` et un lien factice, pour que les démonstrations montrent que
 * la fonction existe — sans jamais bloquer le flux de la clinique.
 */

/** Whether each external channel is configured (keys present). */
export const getIntegrationStatus = query({
  args: {},
  handler: async () => ({
    email: Boolean(process.env.ELASTICEMAIL_API_KEY),
    sms: Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_PHONE_NUMBER,
    ),
    mobileMoney: Boolean(
      process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID,
    ),
  }),
});

export type IntegrationStatus = {
  email: boolean;
  sms: boolean;
  mobileMoney: boolean;
};

/**
 * Internal query: role of a user by id. No session required — the action
 * that calls it has already authenticated via `getAuthUserId`; this only
 * lets the action read the DB (actions have no direct `ctx.db`).
 */
export const getUserRoleById = query({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args,
  ): Promise<"patient" | "staff" | null> => {
    const user = await ctx.db.get<"users">(args.userId);
    return user?.role ?? null;
  },
});

/** Internal shape of the payment info, annotated to break the `api` cycle. */
interface PaymentInfo {
  appointmentId: Id<"appointments">;
  status: string;
  amount: number;
  patientName: string;
  patientPhone: string | null;
  patientEmail: string | null;
  serviceName: string;
  doctorName: string;
  date: string;
  time: string;
}

/**
 * Internal query: everything needed to create a mobile payment request for
 * an appointment. No session required (called from the action, which checks
 * the staff role first); the id is unguessable.
 */
export const getAppointmentPaymentInfo = query({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args): Promise<PaymentInfo | null> => {
    const appointment = await ctx.db.get(args.appointmentId);
    if (!appointment) return null;

    const [doctor, service, profile, grid] = await Promise.all([
      ctx.db.get(appointment.doctorId),
      ctx.db.get(appointment.serviceId),
      ctx.db
        .query("patientProfiles")
        .withIndex("by_user", (q) => q.eq("userId", appointment.userId))
        .first(),
      getPricingGrid(ctx.db),
    ]);

    const price =
      doctor && service ? resolveConsultationPrice(doctor, grid) : 0;
    const amount = computePatientShare(price, profile);

    return {
      appointmentId: appointment._id,
      status: appointment.status,
      amount,
      patientName: profile
        ? `${profile.firstName} ${profile.lastName}`
        : "Patient",
      patientPhone: profile?.phone ?? null,
      patientEmail: profile?.email ?? null,
      serviceName: service?.name ?? "",
      doctorName: doctor?.name ?? "",
      date: appointment.date,
      time: appointment.time,
    };
  },
});

/** Result of a mobile payment request, annotated to break the `api` cycle. */
interface MobilePaymentResult {
  demo: boolean;
  amount: number;
  transactionId: string;
  phone: string;
  checkoutUrl: string | null;
  message: string;
}

/** Staff: request a mobile money payment (Orange Money / MTN MoMo / Wave). */
export const createMobilePaymentRequest = action({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args): Promise<MobilePaymentResult> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Vous devez être connecté pour effectuer cette action.");
    }
    const role = await ctx.runQuery(api.payments.getUserRoleById, { userId });
    if (role !== "staff") {
      throw new Error("Accès réservé à l'administration de la clinique.");
    }

    const info = await ctx.runQuery(api.payments.getAppointmentPaymentInfo, {
      appointmentId: args.appointmentId,
    });
    if (!info) throw new Error("Rendez-vous introuvable.");
    if (info.status === "cancelled") {
      throw new Error("Ce rendez-vous est annulé.");
    }
    if (!info.patientPhone) {
      throw new Error(
        "Le patient n'a pas de numéro de téléphone dans sa fiche — impossible de lancer un paiement mobile.",
      );
    }

    const apiKey = process.env.CINETPAY_API_KEY;
    const siteId = process.env.CINETPAY_SITE_ID;

    const transactionId = `CB-${info.appointmentId}-${Date.now()}`;

    // ---- Mode démo : la fonction existe, mais attend les clés CinetPay. ----
    if (!apiKey || !siteId) {
      console.warn(
        "[payments] Clés CinetPay absentes — paiement mobile en mode démo.",
      );
      await ctx.runMutation(api.payments.recordPaymentActivity, {
        actorId: userId,
        action: "payment.mobile-requested",
        label: "Demande de paiement mobile (mode démo)",
        details: `${info.serviceName} — ${info.date} ${info.time} (${info.amount} FCFA, ${info.patientPhone})`,
      });
      return {
        demo: true,
        amount: info.amount,
        transactionId,
        phone: info.patientPhone,
        checkoutUrl: null,
        message:
          "Mode démo : configurez vos clés CinetPay dans l'onglet « Keys » pour activer les paiements Orange Money / MTN MoMo.",
      };
    }

    // ---- Paiement réel via CinetPay v2 (checkout) ----
    const body = {
      apikey: apiKey,
      site_id: siteId,
      transaction_id: transactionId,
      amount: info.amount,
      currency: "XOF",
      description: `Consultation ${info.serviceName}${info.doctorName ? ` — ${info.doctorName}` : ""} (${info.date} ${info.time})`,
      channels: "OM,MOMO,WAVE",
      customer_id: info.appointmentId,
      customer_name: info.patientName,
      customer_phone: info.patientPhone,
      customer_email: info.patientEmail ?? "",
      lang: "fr",
    };

    let res: Response;
    try {
      res = await fetch("https://api-checkout.cinetpay.com/v2/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (error) {
      console.error("[payments] Échec réseau CinetPay :", error);
      throw new Error("Impossible de contacter le service de paiement.");
    }

    const payload = (await res.json().catch(() => null)) as {
      code?: string;
      message?: string;
      data?: { payment_url?: string; payment_token?: string };
    } | null;

    if (!res.ok || payload?.code !== "201" || !payload.data?.payment_url) {
      console.error(
        `[payments] Échec CinetPay (${res.status}) : ${JSON.stringify(payload).slice(0, 500)}`,
      );
      throw new Error(
        payload?.message || "Le service de paiement a refusé la demande.",
      );
    }

    await ctx.runMutation(api.payments.recordPaymentActivity, {
      actorId: userId,
      action: "payment.mobile-requested",
      label: "Demande de paiement mobile envoyée",
      details: `${info.serviceName} — ${info.date} ${info.time} (${info.amount} FCFA, ${info.patientPhone})`,
    });

    return {
      demo: false,
      amount: info.amount,
      transactionId,
      phone: info.patientPhone,
      checkoutUrl: payload.data.payment_url,
      message: "Demande de paiement créée — envoyez le lien au patient.",
    };
  },
});

/** Staff: keep a record that a payment was collected via mobile money. */
export const recordMobilePayment = mutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Vous devez être connecté pour effectuer cette action.");
    }
    const user = await ctx.db.get<"users">(userId);
    if (user?.role !== "staff") {
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

    const [doctor, service, profile, grid] = await Promise.all([
      ctx.db.get(appointment.doctorId),
      ctx.db.get(appointment.serviceId),
      ctx.db
        .query("patientProfiles")
        .withIndex("by_user", (q) => q.eq("userId", appointment.userId))
        .first(),
      getPricingGrid(ctx.db),
    ]);

    const mobilePrice =
      doctor && service ? resolveConsultationPrice(doctor, grid) : 0;
    const amountPaid = computePatientShare(mobilePrice, profile);

    await ctx.db.patch(args.appointmentId, {
      status: "confirmed",
      amountPaid,
      paidAt: Date.now(),
    });

    // Same multi-channel confirmation as the counter payment (`recordPayment`
    // in appointments.ts): e-mail + SMS + notification in-app right away, and
    // the J-7 / J-3 / J-1 reminders still in the future are scheduled.
    const patient = await ctx.db.get<"users">(appointment.userId);
    const patientEmail = profile?.email ?? patient?.email;
    await ctx.scheduler.runAfter(0, api.emails.sendAppointmentConfirmation, {
      userId: appointment.userId,
      to: patientEmail ?? "",
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
    });
    for (const { daysBefore, runAt } of reminderScheduleTimes(
      appointment.date,
      appointment.time,
    )) {
      await ctx.scheduler.runAt(
        runAt,
        api.emails.sendAppointmentReminder,
        { appointmentId: appointment._id, daysBefore },
      );
    }

    await logActivity(ctx, {
      actorId: userId,
      action: "payment.mobile-recorded",
      label: "Paiement mobile confirmé — rendez-vous confirmé",
      details: `${service?.name ?? ""} — ${appointment.date} ${appointment.time} (${amountPaid} FCFA)`,
    });

    return { amountPaid };
  },
});

/**
 * Internal helper: write an activity-log row. Actions have no `ctx.db`, so
 * they delegate the audit-trail write to this mutation.
 */
export const recordPaymentActivity = mutation({
  args: {
    actorId: v.id("users"),
    action: v.string(),
    label: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await logActivity(ctx, args);
  },
});
