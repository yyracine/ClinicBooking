import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";

/**
 * Demo data: fictional patients with complete medical files (fiche patient,
 * consultations, prescriptions, exams) so the clinic can preview the app
 * with realistic content.
 *
 * Three patients are seeded, visible in the staff "Patients" view:
 *  - Aminata Koné (D-9001) — insured (CNPS, 100 %, tiers payant). This one
 *    also has a real login: demo@clinic-bookings.local / demo1234, so you
 *    can sign in as a patient and open "Mon dossier".
 *  - Jean-Marc Kouassi (D-9002) — insured (Mutuelle Santé Plus, 80 %).
 *  - Fatou Ndiaye (D-9003) — not insured.
 *
 * A few appointments are also created so the staff planning and the
 * payment flow display realistic data.
 */

export const DEMO_EMAIL = "demo@clinic-bookings.local";
export const DEMO_PASSWORD = "demo1234";

/** Dossier numbers reserved for the demo patients (never collide with real D-000x). */
const DEMO_DOSSIER_NUMBERS = ["D-9001", "D-9002", "D-9003"] as const;

/**
 * Fictional visits used to fill the record of the most recently created
 * patient (so the PDF download can be tested with content).
 */
const DEMO_LATEST_VISITS: DemoVisit[] = [
  {
    doctor: "Dr Camille Moreau",
    visitDate: "2026-04-14",
    report:
      "Consultation de contrôle pour fatigue persistante depuis quelques semaines. Bilan sanguin complet réalisé : hémogramme normal, carence en fer corrigée par une supplémentation. Bonne évolution générale, conseils d'hygiène de vie rappelés.",
    medications: [
      { name: "Fer (sulfate ferreux) 80 mg", dosage: "1 comprimé par jour pendant 3 mois" },
    ],
    exams: [
      {
        name: "NFS — hémogramme",
        status: "done",
        comment: "Hémoglobine 12,8 g/dL — normalisée",
      },
      {
        name: "Ferritine",
        status: "done",
        comment: "30 ng/mL — carence initiale corrigée",
      },
      { name: "Bilan thyroïdien", status: "prescribed" },
    ],
    weight: 71,
    height: 170,
    bloodPressure: "126/80",
    temperature: 36.8,
  },
  {
    doctor: "Dr Sophie Dubois",
    visitDate: "2026-06-30",
    report:
      "Examen cardiologique de prévention : aucun symptôme, tension artérielle à 118/76 mmHg, fréquence cardiaque régulière à 68 bpm. ECG de repos sans anomalie. Poursuite d'une activité physique régulière conseillée, contrôle dans un an.",
    medications: [],
    exams: [
      {
        name: "Électrocardiogramme de repos",
        status: "done",
        comment: "Rythme sinusal, 68 bpm, sans anomalie",
      },
      {
        name: "Mesure de la tension artérielle",
        status: "done",
        comment: "118/76 mmHg — normale",
      },
    ],
    weight: 70,
    height: 170,
    bloodPressure: "118/76",
    temperature: 36.7,
  },
];

/* ------------------------------------------------------------------ */
/* Patients                                                            */
/* ------------------------------------------------------------------ */

interface DemoProfile {
  email?: string;
  lastName: string;
  firstName: string;
  birthDate: string;
  phone: string;
  emergencyName?: string;
  emergencyPhone?: string;
  address: string;
  city: string;
  postalCode?: string;
  notes?: string;
  allergies?: string[];
  antecedents?: string[];
  insured: boolean;
  insuranceName?: string;
  reimbursement100?: boolean;
  tiersPayant?: boolean;
  reimbursementRate?: number;
}

interface DemoVisit {
  doctor: string; // doctor name, resolved at insert time
  visitDate: string;
  report: string;
  medications: { name: string; dosage: string }[];
  exams: {
    name: string;
    status: "prescribed" | "done";
    comment?: string;
  }[];
  // Vital signs measured during the visit (optional).
  weight?: number; // kg
  height?: number; // cm
  bloodPressure?: string; // ex. "12/8"
  temperature?: number; // °C
}

interface DemoAppointment {
  user: string; // patient identifier: "aminata" | "jean-marc" | "fatou"
  service: string; // service name
  doctor: string; // doctor name
  date: string; // "yyyy-MM-dd" (or "tomorrow")
  time: string;
  status: "pending" | "confirmed" | "completed";
  notes?: string;
  amountPaid?: number;
  paidAt?: number;
}

const DEMO_PATIENTS: {
  key: "aminata" | "jean-marc" | "fatou";
  dossierNumber: string;
  name: string;
  profile: DemoProfile;
  visits: DemoVisit[];
}[] = [
  {
    key: "aminata",
    dossierNumber: "D-9001",
    name: "Aminata Koné",
    profile: {
      email: DEMO_EMAIL,
      lastName: "Koné",
      firstName: "Aminata",
      birthDate: "1988-04-15",
      phone: "+225 07 08 45 12 34",
      emergencyName: "Moussa Koné",
      emergencyPhone: "+225 05 44 98 76 12",
      address: "12 rue des Jardins",
      city: "Abidjan (Cocody)",
      postalCode: "21 BP 1287",
      notes: "Hypertension artérielle suivie depuis 2023.",
      allergies: ["Pénicilline"],
      antecedents: [
        "Hypertension artérielle (2023)",
        "Cardiopathie hypertensive",
      ],
      insured: true,
      insuranceName: "CNPS",
      reimbursement100: true,
      tiersPayant: true,
      reimbursementRate: 100,
    },
    visits: [
      {
        doctor: "Dr Sophie Dubois",
        visitDate: "2025-11-12",
        report:
          "Suivi de l'hypertension artérielle essentielle, bien équilibrée sous traitement. Examen clinique normal : PA 128/82 mmHg, FC 72 bpm, absence d'œdème des membres inférieurs. Poursuite du traitement actuel. Contrôle dans 3 mois avec holter ECG afin d'éliminer une HTA masquée.",
        medications: [
          { name: "Amlodipine 5 mg", dosage: "1 comprimé matin et soir" },
          { name: "Ramipril 5 mg", dosage: "1 comprimé le matin" },
        ],
        exams: [
          {
            name: "Électrocardiogramme",
            status: "done",
            comment: "Rythme sinusal régulier, 72 bpm, sans trouble de conduction",
          },
          { name: "Holter ECG 24 h", status: "prescribed" },
          {
            name: "Bilan lipidique",
            status: "done",
            comment: "LDL 1,1 g/L — objectif atteint",
          },
        ],
      },
      {
        doctor: "Dr Camille Moreau",
        visitDate: "2026-02-03",
        report:
          "Consultation pour brûlures mictionnelles et douleurs lombaires basses depuis 48 h, sans fièvre. Bandelette urinaire positive aux nitrites. Traitement antibiotique adapté à l'ECBU. Rappel des règles d'hydratation. Contrôle en cas de persistance des symptômes.",
        medications: [
          { name: "Monuril 3 g", dosage: "1 sachet en prise unique le soir" },
          {
            name: "Paracétamol 1 g",
            dosage: "1 comprimé en cas de douleur, max 4 par jour",
          },
        ],
        exams: [
          {
            name: "ECBU avec antibiogramme",
            status: "done",
            comment: "Escherichia coli sensible — traitement adapté",
          },
          { name: "Échographie rénale", status: "prescribed" },
        ],
      },
      {
        doctor: "Dr Sophie Dubois",
        visitDate: "2026-06-18",
        report:
          "Contrôle annuel de la cardiopathie hypertensive. Bonne tolérance du traitement, aucune douleur thoracique. PA 124/78 mmHg. Échocardiographie de contrôle rassurante. Poursuite de l'amlodipine et de l'atorvastatine. Test d'effort programmé pour objectiver la capacité fonctionnelle.",
        medications: [
          { name: "Amlodipine 5 mg", dosage: "1 comprimé matin et soir" },
          { name: "Atorvastatine 20 mg", dosage: "1 comprimé le soir" },
        ],
        exams: [
          {
            name: "Échocardiographie",
            status: "done",
            comment: "Fraction d'éjection 60 %, cavités normales",
          },
          { name: "Test d'effort sur tapis", status: "prescribed" },
        ],
        weight: 68,
        height: 168,
        bloodPressure: "124/78",
        temperature: 36.7,
      },
    ],
  },
  {
    key: "jean-marc",
    dossierNumber: "D-9002",
    name: "Jean-Marc Kouassi",
    profile: {
      email: "jeanmarc.kouassi@exemple.com",
      lastName: "Kouassi",
      firstName: "Jean-Marc",
      birthDate: "1975-09-02",
      phone: "+225 01 02 03 04 05",
      emergencyName: "Adjoa Kouassi",
      emergencyPhone: "+225 07 56 78 90 12",
      address: "45 avenue de la République",
      city: "Abidjan (Treichville)",
      postalCode: "01 BP 4321",
      notes: "Diabète de type 2 diagnostiqué en 2019.",
      allergies: [],
      antecedents: ["Diabète de type 2 (2019)", "Eczéma chronique"],
      insured: true,
      insuranceName: "Mutuelle Santé Plus",
      reimbursement100: false,
      tiersPayant: false,
      reimbursementRate: 80,
    },
    visits: [
      {
        doctor: "Dr Camille Moreau",
        visitDate: "2025-08-21",
        report:
          "Suivi du diabète de type 2. HbA1c en légère amélioration (7,2 % contre 7,8 % en mai). IMC stable à 28,4. Rappel des règles hygiéno-diététiques et de l'activité physique quotidienne. Fond d'œil réalisé : rétinopathie non proliférante débutante. Contrôle dans 6 mois.",
        medications: [
          {
            name: "Metformine 850 mg",
            dosage: "1 comprimé matin et soir pendant les repas",
          },
          { name: "Vitamine D3 100 000 UI", dosage: "1 ampoule par mois" },
        ],
        exams: [
          {
            name: "Hémoglobine glyquée (HbA1c)",
            status: "done",
            comment: "7,2 % — légère amélioration",
          },
          {
            name: "Fond d'œil",
            status: "done",
            comment:
              "Rétinopathie non proliférante débutante — contrôle dans 6 mois",
          },
        ],
      },
      {
        doctor: "Dr Marc Chevallier",
        visitDate: "2026-04-09",
        report:
          "Consultation pour lésions eczémateuses des plis du coude évoluant depuis plusieurs semaines, prurit modéré. Corticothérapie locale en cure courte associée à un émollient. Test cutané : sensibilisation aux acariens confirmée. Éviction des allergènes et literie anti-acariens conseillée.",
        medications: [
          {
            name: "Bétaméthasone crème 0,05 %",
            dosage: "application fine 1 fois par jour pendant 10 jours",
          },
          {
            name: "Émollient (type Dexeryl)",
            dosage: "2 applications par jour sur les zones sèches",
          },
        ],
        exams: [
          { name: "Bilan allergologique", status: "prescribed" },
          {
            name: "Test cutané (prick-tests)",
            status: "done",
            comment: "Sensibilisation aux acariens confirmée",
          },
        ],
        weight: 74,
        height: 172,
        bloodPressure: "132/84",
        temperature: 36.9,
      },
    ],
  },
  {
    key: "fatou",
    dossierNumber: "D-9003",
    name: "Fatou Ndiaye",
    profile: {
      email: "fatou.ndiaye@exemple.com",
      lastName: "Ndiaye",
      firstName: "Fatou",
      birthDate: "2001-12-30",
      phone: "+225 07 11 22 33 44",
      emergencyName: "Seydou Ndiaye",
      emergencyPhone: "+225 05 55 66 77 88",
      address: "8 rue des Manguiers",
      city: "Abidjan (Marcory)",
      postalCode: "BP 220",
      notes: "Fumeuse occasionnelle.",
      allergies: [],
      antecedents: ["Asthme léger d'effort"],
      insured: false,
    },
    visits: [
      {
        doctor: "Dr Camille Moreau",
        visitDate: "2025-10-05",
        report:
          "Rhinopharyngite aiguë : rhinorrhée claire, toux sèche, fébricule à 37,9 °C. Examen ORL sans particularité, pas de signe de gravité. Traitement symptomatique. Éviction du tabac conseillée dans le cadre de son asthme d'effort.",
        medications: [
          {
            name: "Paracétamol 1 g",
            dosage: "1 comprimé 3 fois par jour pendant 5 jours",
          },
          {
            name: "Spray nasal (sérum physiologique)",
            dosage: "2 pulvérisations par narine, 3 fois par jour",
          },
        ],
        exams: [],
      },
      {
        doctor: "Dr Inès Lambert",
        visitDate: "2026-05-22",
        report:
          "Bilan ophtalmologique pour baisse d'acuité visuelle de l'œil droit constatée au travail. Acuité corrigée à 10/10 des deux côtés avec une correction légère de myopie. Fond d'œil normal, tension oculaire à 14 mmHg. Port de lunettes conseillé pour la conduite et le travail sur écran.",
        medications: [],
        exams: [
          {
            name: "Acuité visuelle",
            status: "done",
            comment: "Œil droit 6/10, œil gauche 8/10 sans correction",
          },
          {
            name: "Réfraction sous cycloplégie",
            status: "done",
            comment: "Myopie légère : -0,75 D OD, -0,50 D OG",
          },
          {
            name: "Fond d'œil",
            status: "done",
            comment: "Papilles normales, pas de signe de glaucome",
          },
        ],
        weight: 58,
        height: 162,
        bloodPressure: "118/76",
        temperature: 36.6,
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Appointments                                                        */
/* ------------------------------------------------------------------ */

const DEMO_APPOINTMENTS: DemoAppointment[] = [
  {
    user: "aminata",
    service: "Cardiologie",
    doctor: "Dr Sophie Dubois",
    date: "tomorrow", // resolved at insert time
    time: "09:00",
    status: "pending",
    notes: "Suivi de la tension artérielle.",
  },
  {
    user: "jean-marc",
    service: "Médecine générale",
    doctor: "Dr Camille Moreau",
    date: "2026-06-05",
    time: "10:30",
    status: "confirmed",
    amountPaid: 2000, // 10 000 FCFA − 80 % remboursés
    paidAt: Date.parse("2026-06-05T10:45:00Z"),
  },
  {
    user: "fatou",
    service: "Ophtalmologie",
    doctor: "Dr Inès Lambert",
    date: "2026-05-22",
    time: "14:00",
    status: "completed",
    amountPaid: 15000, // non assurée → tarif plein
    paidAt: Date.parse("2026-05-22T14:25:00Z"),
  },
];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ------------------------------------------------------------------ */
/* Mutation: insert patients, profiles, visits, appointments           */
/* ------------------------------------------------------------------ */

export const seedDemoPatients = mutation({
  args: { demoPatientUserId: v.union(v.id("users"), v.null()) },
  handler: async (ctx, args) => {
    // Idempotent: if a demo dossier already exists, do nothing.
    const existing = await ctx.db
      .query("patientProfiles")
      .filter((q) =>
        q.or(
          q.eq(q.field("dossierNumber"), "D-9001"),
          q.eq(q.field("dossierNumber"), "D-9002"),
          q.eq(q.field("dossierNumber"), "D-9003"),
        ),
      )
      .collect();
    if (existing.length > 0) {
      return { seeded: false, patients: existing.length };
    }

    const doctors = await ctx.db.query("doctors").collect();
    const doctorId = (name: string): Id<"doctors"> => {
      const d = doctors.find((x) => x.name === name);
      if (!d) throw new Error(`Médecin introuvable pour la démo : ${name}`);
      return d._id;
    };
    const services = await ctx.db.query("services").collect();
    const serviceId = (name: string): Id<"services"> => {
      const s = services.find((x) => x.name === name);
      if (!s) throw new Error(`Service introuvable pour la démo : ${name}`);
      return s._id;
    };

    // Aminata already has an account (created by the action); the other two
    // demo patients are plain user rows without login.
    const aminataUserId =
      args.demoPatientUserId ??
      (await ctx.db.insert("users", {
        name: "Aminata Koné",
        email: DEMO_EMAIL,
        role: "patient",
      }));
    const userIds: Record<string, Id<"users">> = {
      aminata: aminataUserId,
      "jean-marc": await ctx.db.insert("users", {
        name: "Jean-Marc Kouassi",
        email: "jeanmarc.kouassi@exemple.com",
        role: "patient",
      }),
      fatou: await ctx.db.insert("users", {
        name: "Fatou Ndiaye",
        email: "fatou.ndiaye@exemple.com",
        role: "patient",
      }),
    };

    for (const p of DEMO_PATIENTS) {
      await ctx.db.insert("patientProfiles", {
        userId: userIds[p.key],
        dossierNumber: p.dossierNumber,
        ...p.profile,
      });

      for (const v of p.visits) {
        await ctx.db.insert("visits", {
          userId: userIds[p.key],
          doctorId: doctorId(v.doctor),
          visitDate: v.visitDate,
          report: v.report,
          medications: v.medications,
          exams: v.exams,
          weight: v.weight,
          height: v.height,
          bloodPressure: v.bloodPressure,
          temperature: v.temperature,
        });
      }
    }

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    for (const a of DEMO_APPOINTMENTS) {
      const date = a.date === "tomorrow" ? toDateKey(tomorrow) : a.date;
      await ctx.db.insert("appointments", {
        userId: userIds[a.user],
        serviceId: serviceId(a.service),
        doctorId: doctorId(a.doctor),
        date,
        time: a.time,
        status: a.status,
        notes: a.notes,
        amountPaid: a.amountPaid,
        paidAt: a.paidAt,
      });
    }

    return {
      seeded: true,
      patients: DEMO_PATIENTS.length,
      visits: DEMO_PATIENTS.reduce((n, p) => n + p.visits.length, 0),
      appointments: DEMO_APPOINTMENTS.length,
    };
  },
});

/**
 * Fill the record of the most recently created patient with fictional
 * visits (idempotent: skipped when the newest patient already has visits).
 * Lets the PDF download of the dossier be tested with real content.
 */
export const fillLatestPatientDemoVisits = mutation({
  args: {},
  handler: async (ctx) => {
    const profiles = await ctx.db.query("patientProfiles").collect();
    const latest = [...profiles]
      .sort((a, b) => b._creationTime - a._creationTime)
      .find((p) => !(DEMO_DOSSIER_NUMBERS as readonly string[]).includes(p.dossierNumber));
    if (!latest) return { filled: false, reason: "no-patient" };

    const existing = await ctx.db
      .query("visits")
      .withIndex("by_user", (q) => q.eq("userId", latest.userId))
      .collect();
    if (existing.length > 0) return { filled: false, reason: "has-visits" };

    const doctors = await ctx.db.query("doctors").collect();
    for (const v of DEMO_LATEST_VISITS) {
      const doctor = doctors.find((d) => d.name === v.doctor);
      if (!doctor) continue;
      await ctx.db.insert("visits", {
        userId: latest.userId,
        doctorId: doctor._id,
        visitDate: v.visitDate,
        report: v.report,
        medications: v.medications,
        exams: v.exams,
        weight: v.weight,
        height: v.height,
        bloodPressure: v.bloodPressure,
        temperature: v.temperature,
      });
    }
    return { filled: true, visits: DEMO_LATEST_VISITS.length };
  },
});


