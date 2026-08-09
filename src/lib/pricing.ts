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
