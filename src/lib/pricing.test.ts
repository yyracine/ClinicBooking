import { describe, expect, it } from "vitest";
import { computePatientShare } from "./pricing";

describe("computePatientShare", () => {
  const PRICE = 25000;

  it("non-insured patient pays the full price", () => {
    expect(computePatientShare(PRICE, { insured: false })).toBe(PRICE);
  });

  it("tiers payant means nothing to pay up front", () => {
    expect(
      computePatientShare(PRICE, { insured: true, tiersPayant: true }),
    ).toBe(0);
  });

  it("100 % reimbursement means nothing to pay", () => {
    expect(
      computePatientShare(PRICE, { insured: true, reimbursement100: true }),
    ).toBe(0);
  });

  it("insured without details pays in advance (reimbursed later)", () => {
    expect(computePatientShare(PRICE, { insured: true })).toBe(PRICE);
  });

  it("applies the reimbursement rate", () => {
    // 25 000 × (100 − 70) / 100 = 7 500
    expect(
      computePatientShare(PRICE, { insured: true, reimbursementRate: 70 }),
    ).toBe(7500);
  });

  it("a rate above 100 % clamps to 0", () => {
    expect(
      computePatientShare(PRICE, { insured: true, reimbursementRate: 120 }),
    ).toBe(0);
  });

  it("rounds to whole FCFA", () => {
    expect(
      computePatientShare(10001, { insured: true, reimbursementRate: 50 }),
    ).toBe(5001); // Math.round(5000.5) → 5001
  });

  it("treats missing insurance data as full price", () => {
    expect(computePatientShare(PRICE, null)).toBe(PRICE);
    expect(computePatientShare(PRICE, undefined)).toBe(PRICE);
  });
});
