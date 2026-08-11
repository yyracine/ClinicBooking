import { v } from "convex/values";
import { api } from "./_generated/api";
import { ActionCtx, action } from "./_generated/server";
import { toE164 } from "../lib/booking";

/**
 * Notifications transactionnelles de la clinique, envoyées par e-mail
 * (Elastic Email), SMS (Twilio) et dans l'application (cloche) :
 *
 *  - `sendAppointmentConfirmation` : confirmation, déclenchée quand le
 *    l'équipe valide le paiement (le rendez-vous passe à « confirmé »).
 *  - `sendAppointmentReminder` : rappels J-7 / J-3 / J-1, planifiés par
 *    `recordPayment` (voir `reminderScheduleTimes` dans lib/booking.ts).
 *  - `sendSlotAvailable` : « un créneau s'est libéré » au premier patient
 *    de la liste d'attente à chaque annulation.
 *
 * Les clés sont lues dans l'environnement (onglet « Keys » de Freebuff) :
 *  - `ELASTICEMAIL_API_KEY`   → e-mails
 *  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` → SMS
 * Sans clé configurée, le canal correspondant journalise un avertissement
 * et le flux continue (dégradation douce, mode démo) : les notifications
 * in-app, elles, sont toujours créées.
 */

const FROM_EMAIL = "Clinic Bookings <noreply@clinic-bookings.local>";

/** Result of a send attempt (annotated to break the api circular reference). */
type SendResult =
  | { sent: true; reason?: never; status?: never; messageId?: string }
  | { sent: false; reason: string; status?: number; messageId?: never };

const DAY_NAMES = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

const MONTH_NAMES = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** "2026-08-12" -> "mercredi 12 août 2026" */
function formatDateFR(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]} ${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

/** Escape user-provided values before embedding them in the HTML body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Shared details block used by all e-mail templates. */
function detailsBlock(a: {
  serviceName: string;
  doctorName: string;
  doctorTitle: string;
  date: string;
  time: string;
  notes?: string;
}): string {
  const doctor = a.doctorName
    ? `${escapeHtml(a.doctorName)}${
        a.doctorTitle ? ` — ${escapeHtml(a.doctorTitle)}` : ""
      }`
    : "—";
  const notes = a.notes?.trim() ? escapeHtml(a.notes.trim()) : null;

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:10px 0;width:120px;vertical-align:top;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;font-weight:600;">${label}</td>
      <td style="padding:10px 0;vertical-align:top;font-size:14px;color:#1e293b;font-weight:600;">${value}</td>
    </tr>`;

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:6px 18px;">
      ${row("Service", escapeHtml(a.serviceName))}
      ${row("Praticien", doctor)}
      ${row("Date", formatDateFR(a.date))}
      ${row("Heure", escapeHtml(a.time))}
      ${notes ? row("Notes", notes) : ""}
    </table>`;
}

/** Shared e-mail shell (header + footer) used by all templates. */
function shell(opts: {
  badge: string;
  greeting: string;
  intro: string;
  details: string;
}): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8;padding:32px 0;font-family:Inter,Arial,Helvetica,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 16px rgba(15,23,42,0.06);">
        <!-- Header -->
        <tr>
          <td style="background-color:#0d9488;padding:22px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:16px;font-weight:800;color:#ffffff;letter-spacing:0.02em;">Clinic Bookings</td>
                <td align="right" style="font-size:11px;color:#ccfbf1;font-weight:600;">${opts.badge}</td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px 8px 32px;">
            <p style="margin:0 0 6px 0;font-size:15px;color:#1e293b;font-weight:700;">
              ${opts.greeting}
            </p>
            <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6;">
              ${opts.intro}
            </p>
          </td>
        </tr>
        <!-- Details -->
        <tr>
          <td style="padding:16px 32px;">${opts.details}</td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:8px 32px 28px 32px;font-size:12px;color:#94a3b8;line-height:1.6;">
            Pour modifier ou annuler ce rendez-vous, connectez-vous à votre espace patient.
            <br/>Cet e-mail est un message automatique — merci de ne pas y répondre.
          </td>
        </tr>
      </table>
      <p style="margin:18px 0 0 0;font-size:11px;color:#cbd5e1;">Document confidentiel — Clinic Bookings</p>
    </td>
  </tr>
</table>`;
}

interface AppointmentMailData {
  patientName: string;
  serviceName: string;
  doctorName: string;
  doctorTitle: string;
  date: string;
  time: string;
  notes?: string;
}

/** Render the confirmation e-mail body. */
function confirmationHtml(a: AppointmentMailData): string {
  return shell({
    badge: "Confirmation de rendez-vous",
    greeting: `Bonjour ${escapeHtml(a.patientName)},`,
    intro:
      "Votre rendez-vous est <strong style=\"color:#0d9488;\">confirmé</strong>. Retrouvez le récapitulatif ci-dessous — merci de vous présenter quelques minutes avant l'heure prévue.",
    details: detailsBlock(a),
  });
}

/** Human French phrasing of the delay: "demain", "dans 3 jours"… */
function daysPhrase(daysBefore: number): string {
  return daysBefore === 1 ? "demain" : `dans ${daysBefore} jours`;
}

/** Render the reminder e-mail body (J-7, J-3 or J-1). */
function reminderHtml(a: AppointmentMailData, daysBefore: number): string {
  return shell({
    badge:
      daysBefore === 1
        ? "Rappel de rendez-vous"
        : `Rappel de rendez-vous (J-${daysBefore})`,
    greeting: `Bonjour ${escapeHtml(a.patientName)},`,
    intro: `Petit rappel : votre rendez-vous à la clinique a lieu <strong style="color:#0d9488;">${daysPhrase(daysBefore)}</strong>. Si vous ne pouvez pas vous libérer, pensez à l'annuler depuis votre espace patient.`,
    details: detailsBlock(a),
  });
}

/** Render the « créneau libéré » e-mail body (waiting list). */
function slotAvailableHtml(a: AppointmentMailData): string {
  return shell({
    badge: "Créneau libéré",
    greeting: `Bonjour ${escapeHtml(a.patientName)},`,
    intro:
      "Un créneau vient de se libérer : connectez-vous rapidement à votre espace patient pour réserver la place avant qu'elle ne soit reprise.",
    details: detailsBlock(a),
  });
}

/* ------------------------------------------------------------------ */
/* Channel senders (e-mail + SMS) — each degrades gracefully            */
/* ------------------------------------------------------------------ */

/** Send one transactional e-mail through Elastic Email v4. */
async function sendViaElasticEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const apiKey = process.env.ELASTICEMAIL_API_KEY;
  if (!apiKey) {
    console.warn("[emails] ELASTICEMAIL_API_KEY absente — e-mail non envoyé.");
    return { sent: false, reason: "no-key" };
  }

  const res = await fetch("https://api.elasticemail.com/v4/emails", {
    method: "POST",
    headers: {
      "x-elasticemail-apikey": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Recipients: { To: [opts.to] },
      Content: {
        From: FROM_EMAIL,
        Subject: opts.subject,
        Body: [{ ContentType: "HTML", Content: opts.html }],
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `[emails] Échec Elastic Email (${res.status}) : ${body.slice(0, 500)}`,
    );
    return { sent: false, reason: "http-error", status: res.status };
  }

  const messageId = await res.text().catch(() => "");
  console.log(`[emails] ${opts.subject} envoyé à ${opts.to} (${messageId}).`);
  return { sent: true, messageId };
}

/**
 * Send one SMS through the Twilio REST API. The phone number is normalized
 * to E.164 first (`toE164`, unit-tested). Without the Twilio keys, the
 * channel reports `no-key` and the flow continues (mode démo).
 */
async function sendViaTwilio(opts: {
  to: string;
  body: string;
}): Promise<SendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !from) {
    console.warn(
      "[emails] Clés Twilio absentes (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER) — SMS non envoyé.",
    );
    return { sent: false, reason: "no-key" };
  }

  const to = toE164(opts.to);
  if (!to) {
    console.warn(`[emails] Téléphone illisible — SMS non envoyé (${opts.to}).`);
    return { sent: false, reason: "bad-phone" };
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Body: opts.body,
      }).toString(),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[emails] Échec Twilio (${res.status}) : ${body.slice(0, 500)}`);
    return { sent: false, reason: "http-error", status: res.status };
  }

  console.log(`[emails] SMS envoyé à ${to}.`);
  return { sent: true };
}

/* ------------------------------------------------------------------ */
/* Shared delivery: notification in-app + e-mail + SMS                  */
/* ------------------------------------------------------------------ */

interface AppointmentNotice {
  userId?: string;
  to?: string;
  phone?: string;
  patientName: string;
  serviceName: string;
  doctorName: string;
  doctorTitle: string;
  date: string;
  time: string;
  notes?: string;
  /** In-app notification payload (always delivered). */
  type: string;
  title: string;
  body: string;
  /** E-mail payload. */
  emailSubject: string;
  emailHtml: string;
  /** SMS payload (short French text). */
  smsBody: string;
}

/**
 * Deliver an appointment notice on every configured channel:
 *  1. in-app notification (always — no key needed),
 *  2. e-mail via Elastic Email (when the patient has an address),
 *  3. SMS via Twilio (when the patient has a phone number).
 * Never throws: each channel degrades gracefully and reports its result.
 */
async function deliverAppointmentNotice(
  ctx: ActionCtx,
  notice: AppointmentNotice,
  channels?: { email?: boolean; sms?: boolean; inApp?: boolean },
): Promise<{ email: SendResult; sms: SendResult }> {
  const channels_ = channels ?? { email: true, sms: true, inApp: true };

  if (channels_.inApp !== false && notice.userId) {
    await ctx.runMutation(api.notifications.create, {
      userId: notice.userId as never,
      type: notice.type,
      title: notice.title,
      body: notice.body,
    }).catch((error) => {
      console.error("[emails] Échec notification in-app :", error);
    });
  }

  const email: SendResult =
    channels_.email !== false && notice.to
      ? await sendViaElasticEmail({
          to: notice.to,
          subject: notice.emailSubject,
          html: notice.emailHtml,
        })
      : { sent: false, reason: channels_.email === false ? "not-consented" : "no-email" };

  const sms: SendResult =
    channels_.sms !== false && notice.phone
      ? await sendViaTwilio({ to: notice.phone, body: notice.smsBody })
      : { sent: false, reason: channels_.sms === false ? "not-consented" : "no-phone" };

  return { email, sms };
}

/** Short appointment summary shared by all SMS texts. */
function smsDetails(notice: {
  date: string;
  time: string;
  doctorName: string;
  serviceName: string;
}): string {
  const doctor = notice.doctorName
    ? ` avec ${notice.doctorName}`
    : ` pour ${notice.serviceName}`;
  return `le ${formatDateFR(notice.date)} à ${notice.time}${doctor}`;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/** Confirmation (e-mail + SMS + notification) after the payment is valid. */
export const sendAppointmentConfirmation = action({
  args: {
    userId: v.optional(v.id("users")),
    to: v.string(),
    phone: v.optional(v.string()),
    patientName: v.string(),
    serviceName: v.string(),
    doctorName: v.string(),
    doctorTitle: v.string(),
    date: v.string(),
    time: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ email: SendResult; sms: SendResult }> => {
    let profile;
    if (args.userId) {
      profile = await ctx.runQuery(
        api.records.getPatientRecord,
        { userId: args.userId }
      );
      if (!profile) {
        console.log(`[emails] Profil patient introuvable pour ${args.userId}`);
      }
    }

    const notice: AppointmentNotice = {
      userId: args.userId,
      to: args.to,
      phone: args.phone,
      patientName: args.patientName,
      serviceName: args.serviceName,
      doctorName: args.doctorName,
      doctorTitle: args.doctorTitle,
      date: args.date,
      time: args.time,
      notes: args.notes,
      type: "appointment.confirmed",
      title: "Rendez-vous confirmé",
      body: `Votre rendez-vous du ${formatDateFR(args.date)} à ${args.time} est confirmé. Merci de vous présenter quelques minutes avant.`,
      emailSubject: "Votre rendez-vous est confirmé",
      emailHtml: confirmationHtml(args),
      smsBody: `Clinic Bookings : votre rendez-vous est confirmé ${smsDetails(args)}.`,
    };

    if (profile) {
      const emailConsent = profile.consentEmailReminders === true;
      const smsConsent = profile.consentSmsReminders === true;
      const inAppConsent =
        profile.consentInAppReminders === true ||
        (!emailConsent && !smsConsent);

      return deliverAppointmentNotice(ctx, notice, {
        email: emailConsent && process.env.ELASTICEMAIL_API_KEY ? true : false,
        sms: smsConsent && process.env.TWILIO_ACCOUNT_SID ? true : false,
        inApp: inAppConsent,
      });
    }

    return deliverAppointmentNotice(ctx, notice);
  },
});

/** « Créneau libéré » for the first patient of a waiting list. */
export const sendSlotAvailable = action({
  args: {
    userId: v.optional(v.id("users")),
    to: v.string(),
    phone: v.optional(v.string()),
    patientName: v.string(),
    serviceName: v.string(),
    doctorName: v.string(),
    doctorTitle: v.string(),
    date: v.string(),
    time: v.string(),
  },
  handler: async (ctx, args): Promise<{ email: SendResult; sms: SendResult }> => {
    const notice: AppointmentNotice = {
      userId: args.userId,
      to: args.to,
      phone: args.phone,
      patientName: args.patientName,
      serviceName: args.serviceName,
      doctorName: args.doctorName,
      doctorTitle: args.doctorTitle,
      date: args.date,
      time: args.time,
      type: "waiting.slot",
      title: "Un créneau s'est libéré",
      body: `Un créneau vient de se libérer ${smsDetails(args)}. Connectez-vous rapidement pour le réserver.`,
      emailSubject: "Un créneau vient de se libérer",
      emailHtml: slotAvailableHtml(args),
      smsBody: `Clinic Bookings : un créneau vient de se libérer ${smsDetails(args)}. Réservez-le vite !`,
    };
    return deliverAppointmentNotice(ctx, notice);
  },
});

/**
 * Reminder J-7 / J-3 / J-1, scheduled by `recordPayment` (see
 * `reminderScheduleTimes`). Re-reads the appointment at send time: the
 * notification only goes out when the appointment is still confirmed (a
 * cancelled or completed appointment never receives a reminder).
 */
export const sendAppointmentReminder = action({
  args: {
    appointmentId: v.id("appointments"),
    daysBefore: v.number(),
  },
  handler: async (ctx, args): Promise<{ email: SendResult; sms: SendResult }> => {
    const info = await ctx.runQuery(api.appointments.getReminderInfo, {
      appointmentId: args.appointmentId,
    });
    if (!info) {
      console.log(
        `[emails] Rappel ignoré pour ${args.appointmentId} (non confirmé ou sans contact).`,
      );
      return {
        email: { sent: false, reason: "not-confirmed" },
        sms: { sent: false, reason: "not-confirmed" },
      };
    }

    const profile = await ctx.runQuery(
      api.records.getPatientRecord,
      { userId: info.userId }
    );
    if (!profile) {
      console.log(`[emails] Profil patient introuvable pour ${info.userId}`);
      return {
        email: { sent: false, reason: "no-profile" },
        sms: { sent: false, reason: "no-profile" },
      };
    }

    const daysBefore = args.daysBefore;
    const notice: AppointmentNotice = {
      userId: info.userId,
      to: info.to,
      phone: info.phone,
      patientName: info.patientName,
      serviceName: info.serviceName,
      doctorName: info.doctorName,
      doctorTitle: info.doctorTitle,
      date: info.date,
      time: info.time,
      notes: info.notes,
      type: "appointment.reminder",
      title:
        daysBefore === 1
          ? "Rappel : rendez-vous demain"
          : `Rappel : rendez-vous dans ${daysBefore} jours`,
      body: `Rappel : votre rendez-vous a lieu ${daysPhrase(daysBefore)} ${smsDetails(info)}. Pensez à l'annuler si vous ne pouvez pas venir.`,
      emailSubject:
        daysBefore === 1
          ? "Rappel : votre rendez-vous est demain"
          : `Rappel : votre rendez-vous est dans ${daysBefore} jours`,
      emailHtml: reminderHtml(info, daysBefore),
      smsBody: `Clinic Bookings : rappel, votre rendez-vous ${smsDetails(info)} a lieu ${daysPhrase(daysBefore)}.`,
    };

    const emailConsent = profile.consentEmailReminders === true;
    const smsConsent = profile.consentSmsReminders === true;
    const inAppConsent =
      profile.consentInAppReminders === true ||
      (!emailConsent && !smsConsent);

    return deliverAppointmentNotice(ctx, notice, {
      email: emailConsent && process.env.ELASTICEMAIL_API_KEY ? true : false,
      sms: smsConsent && process.env.TWILIO_ACCOUNT_SID ? true : false,
      inApp: inAppConsent,
    });
  },
});
