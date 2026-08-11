import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// user roles for the clinic: patients book appointments, staff manage them
export const ROLES = {
  PATIENT: "patient",
  STAFF: "staff",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.PATIENT),
  v.literal(ROLES.STAFF),
);
export type Role = Infer<typeof roleValidator>;

export const appointmentStatusValidator = v.union(
  v.literal("pending"), // booked, awaiting payment at the clinic
  v.literal("confirmed"), // paid at the clinic
  v.literal("completed"), // appointment is done
  v.literal("cancelled"), // appointment was cancelled
);
export type AppointmentStatus = Infer<typeof appointmentStatusValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user (patient | staff)
      staffRole: v.optional(
        // staff sub-role (équipe de la clinique)
        v.union(
          v.literal("admin"),
          v.literal("medecin"),
          v.literal("accueil"),
        ),
      ),
      disabled: v.optional(v.boolean()), // staff account deactivated?
      // Individual staff passwords (SHA-256 + salt, see convex/staff.ts):
      // staff members can sign in with their own identifier + password
      // through the "staff" provider, in addition to the shared password.
      staffPasswordHash: v.optional(v.string()),
      staffPasswordSalt: v.optional(v.string()),
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Medical services offered by the clinic (ex: cardiologie, dentisterie...)
    services: defineTable({
      name: v.string(), // service name (fr)
      description: v.string(), // short description (fr)
      durationMinutes: v.number(), // duration of a consultation
      price: v.number(), // price in FCFA
      icon: v.string(), // lucide icon key used on the frontend
      color: v.string(), // tint key used on the frontend
    }),

    // Practitioners of the clinic. Each doctor has a record card (fiche)
    // filled by the staff: contact details and weekly working hours
    // (jours et heures de vacation), which drive slot availability.
    doctors: defineTable({
      name: v.string(),
      firstName: v.optional(v.string()), // prénom(s) from the fiche
      lastName: v.optional(v.string()), // nom from the fiche
      serviceId: v.id("services"), // specialty
      title: v.string(), // job title (fr)
      bio: v.string(), // short bio (fr)
      phone: v.optional(v.string()), // contact number from the fiche
      consultationPrice: v.optional(v.number()), // price of one consultation, FCFA (no decimals)
      // Weekly working hours: one entry per workday.
      schedule: v.optional(
        v.array(
          v.object({
            day: v.number(), // JS getDay(): 0 = dimanche … 6 = samedi
            start: v.string(), // "HH:mm"
            end: v.string(), // "HH:mm"
          }),
        ),
      ),
      color: v.string(), // avatar tint key
    }).index("by_service", ["serviceId"]),

    // Appointments: one row per booked consultation
    appointments: defineTable({
      userId: v.id("users"), // patient who booked
      serviceId: v.id("services"),
      doctorId: v.id("doctors"),
      date: v.string(), // "yyyy-MM-dd"
      time: v.string(), // "HH:mm" start of the slot
      status: appointmentStatusValidator,
      notes: v.optional(v.string()), // optional patient notes
      amountPaid: v.optional(v.number()), // FCFA collected when the payment is validated
      paidAt: v.optional(v.number()), // timestamp of the payment validation
    })
      .index("by_user", ["userId"])
      .index("by_doctor_date", ["doctorId", "date"]),

    // Patient record card (fiche patient): one per patient account.
    patientProfiles: defineTable({
      userId: v.id("users"),
      dossierNumber: v.string(), // e.g. "D-0001"
      email: v.optional(v.string()), // login/contact email of the patient
      lastName: v.string(),
      firstName: v.string(),
      birthDate: v.string(), // "yyyy-MM-dd"
      phone: v.string(),
      emergencyName: v.optional(v.string()),
      emergencyPhone: v.optional(v.string()),
      address: v.string(),
      city: v.string(),
      postalCode: v.optional(v.string()),
      notes: v.optional(v.string()), // particularities, free notes
      allergies: v.optional(v.array(v.string())), // structured allergies list
      antecedents: v.optional(v.array(v.string())), // structured medical history
      // Dossier enrichi (fiche médicale approfondie).
      bloodGroup: v.optional(v.string()), // groupe sanguin, ex. "O+"
      familyHistory: v.optional(v.array(v.string())), // antécédents familiaux
      surgicalHistory: v.optional(v.array(v.string())), // antécédents chirurgicaux
      currentTreatments: v.optional(v.array(v.string())), // traitements en cours
      insured: v.boolean(), // covered by a health insurance?
      insuranceName: v.optional(v.string()), // insurance provider name
      reimbursement100: v.optional(v.boolean()), // reimbursed at 100%
      tiersPayant: v.optional(v.boolean()), // third-party payment (no upfront fees)
      reimbursementRate: v.optional(v.number()), // reimbursement rate (%)

      // Consent for reminder channels (opt-in, no reminders without explicit consent)
      consentEmailReminders: v.optional(v.boolean()), // accept email reminders (non-encrypted, risk acknowledged)
      consentSmsReminders: v.optional(v.boolean()), // accept SMS reminders
      consentInAppReminders: v.optional(v.boolean()), // accept in-app notifications
    }).index("by_user", ["userId"]),

    // Medical file: one visit report per consultation.
    visits: defineTable({
      userId: v.id("users"), // patient
      doctorId: v.id("doctors"),
      visitDate: v.string(), // "yyyy-MM-dd"
      report: v.string(), // detailed account written by the doctor
      diagnosis: v.optional(v.string()), // diagnostic retenu (dossier enrichi)
      advice: v.optional(v.string()), // conseils / conduite à tenir
      followUpDate: v.optional(v.string()), // prochaine consultation "yyyy-MM-dd"
      medications: v.array(
        v.object({
          name: v.string(),
          dosage: v.string(), // posology
        }),
      ),
      exams: v.array(
        v.object({
          name: v.string(),
          status: v.union(v.literal("prescribed"), v.literal("done")),
          comment: v.optional(v.string()),
        }),
      ),
      // Vital signs measured during the visit (dossier enrichi).
      weight: v.optional(v.number()), // kg
      height: v.optional(v.number()), // cm
      bloodPressure: v.optional(v.string()), // ex. "12/8" ou "120/80"
      temperature: v.optional(v.number()), // °C
    }).index("by_user", ["userId"]),

    // Attached documents of a visit (exam results, scanned prescriptions…).
    medicalFiles: defineTable({
      userId: v.id("users"), // patient
      visitId: v.id("visits"),
      storageId: v.string(), // Convex file storage id
      name: v.string(), // original file name
      mimeType: v.optional(v.string()),
      size: v.optional(v.number()), // bytes
    })
      .index("by_visit", ["visitId"])
      .index("by_user", ["userId"]),

    // Days the doctors are off (congés / indisponibilités): slots on those
    // dates are closed to booking.
    doctorOffDays: defineTable({
      doctorId: v.id("doctors"),
      startDate: v.string(), // "yyyy-MM-dd" (inclusive)
      endDate: v.string(), // "yyyy-MM-dd" (inclusive)
      reason: v.optional(v.string()),
    }).index("by_doctor", ["doctorId"]),

    // Waiting list: patients who want a slot for a doctor on a date when
    // nothing is available. When an appointment is cancelled, the first
    // patient in line is notified of the freed slot.
    waitingList: defineTable({
      doctorId: v.id("doctors"),
      date: v.string(), // "yyyy-MM-dd"
      userId: v.id("users"),
    })
      .index("by_doctor_date", ["doctorId", "date"])
      .index("by_user", ["userId"]),

    // Activity log (audit trail): every important action of the clinic.
    // Ordered by _creationTime (implicit), no index needed.
    activityLogs: defineTable({
      actorId: v.optional(v.id("users")),
      action: v.string(), // machine key, ex. "appointment.paid"
      label: v.string(), // human-readable label (fr)
      details: v.optional(v.string()),
    }),

    // In-app notifications (cloche): one row per notification sent to a
    // patient or a staff member (confirmation, rappels, créneau libéré…).
    notifications: defineTable({
      userId: v.id("users"), // recipient (patient or staff account)
      type: v.string(), // machine key, ex. "appointment.confirmed"
      title: v.string(), // short title (fr)
      body: v.string(), // message body (fr)
      link: v.optional(v.string()), // optional in-app navigation hint
      read: v.boolean(), // read by the recipient?
    }).index("by_user", ["userId"]),

    // Clinic-wide settings (key/value): shared staff password, etc.
    clinicSettings: defineTable({
      key: v.string(),
      value: v.string(),
    }).index("by_key", ["key"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
