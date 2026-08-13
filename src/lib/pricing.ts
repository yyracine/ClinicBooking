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

/** La grille tarifaire à 3 catégories de la clinique (FCFA). */
export interface PricingGrid {
  generaliste: number;
  specialiste: number;
  professeur: number;
}

/** Valeurs de secours tant que l'administration n'a pas configuré sa grille. */
export const DEFAULT_PRICING_GRID: PricingGrid = {
  generaliste: 10000,
  specialiste: 20000,
  professeur: 30000,
};

/**
 * Prix effectif d'une consultation pour un médecin et une grille tarifaire.
 *
 * Recherche dans la grille selon la catégorie du médecin.
 * Si la grille est absente ou invalide, utilise les valeurs par défaut.
 */
export function resolveConsultationPrice(
  doctor: { category: "generaliste" | "specialiste" | "professeur" },
  grid: PricingGrid | null | undefined,
): number {
  if (!grid) return DEFAULT_PRICING_GRID[doctor.category];
  const price = grid[doctor.category];
  if (price == null || !Number.isFinite(price)) {
    return DEFAULT_PRICING_GRID[doctor.category];
  }
  return price;
}
