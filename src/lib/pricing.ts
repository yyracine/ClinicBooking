/** Insurance data as stored on the patient record card. */
export interface InsuranceLike {
  insured: boolean;
  insuranceName?: string;
  reimbursement100?: boolean;
  tiersPayant?: boolean;
  reimbursementRate?: number;
}

/**
 * Share of the consultation price the patient pays at the clinic (FCFA).
 *
 * - Not insured                → full price
 * - Tiers payant or 100 %      → nothing to pay (the insurance covers it)
 * - Reimbursement rate set     → price × (100 − rate) / 100, rounded
 * - Insured without details    → full price (advanced, reimbursed later)
 *
 * Amounts are whole FCFA: no decimals.
 */
export function computePatientShare(
  price: number,
  insurance: InsuranceLike | null | undefined,
): number {
  if (!insurance || !insurance.insured) return price;
  if (insurance.tiersPayant || insurance.reimbursement100) return 0;
  const rate = insurance.reimbursementRate;
  if (rate == null) return price;
  return Math.max(0, Math.round((price * (100 - rate)) / 100));
}

export type AcademicRank = "medecin" | "professeur";

/** La grille tarifaire à 4 catégories de la clinique (FCFA). */
export interface PricingGrid {
  generalisteMedecin: number;
  generalisteProfesseur: number;
  specialisteMedecin: number;
  specialisteProfesseur: number;
}

/** Valeurs de secours tant que l'administration n'a pas configuré sa grille. */
export const DEFAULT_PRICING_GRID: PricingGrid = {
  generalisteMedecin: 10000,
  generalisteProfesseur: 15000,
  specialisteMedecin: 20000,
  specialisteProfesseur: 30000,
};

/**
 * Prix effectif d'une consultation pour un couple médecin + service.
 *
 * 1. `doctor.consultationPrice` renseigné → tarif exceptionnel, prime
 *    toujours (ex. médecin sollicité pour une intervention particulière).
 * 2. Sinon, recherche dans `grid` selon la catégorie (service.isGeneralist ×
 *    grade du médecin).
 * 3. Sinon (grille absente ou cellule manquante) → prix du service, pour
 *    qu'une consultation ne se retrouve jamais à 0 FCFA par accident.
 */
export function resolveConsultationPrice(
  doctor: { consultationPrice?: number; academicRank?: AcademicRank },
  service: { price: number; isGeneralist?: boolean },
  grid: PricingGrid | null | undefined,
): number {
  if (doctor.consultationPrice != null) return doctor.consultationPrice;
  if (grid) {
    const rank = doctor.academicRank ?? "medecin";
    const key: keyof PricingGrid = service.isGeneralist
      ? rank === "professeur"
        ? "generalisteProfesseur"
        : "generalisteMedecin"
      : rank === "professeur"
        ? "specialisteProfesseur"
        : "specialisteMedecin";
    const value = grid[key];
    if (value != null) return value;
  }
  return service.price;
}
