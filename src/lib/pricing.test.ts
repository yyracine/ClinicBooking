import { describe, it, expect } from "vitest";
import {
  computePatientShare,
  resolveConsultationPrice,
  DEFAULT_PRICING_GRID,
  type PricingGrid,
} from "./pricing";

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

describe("resolveConsultationPrice", () => {
  const testGrid: PricingGrid = {
    generaliste: 10000,
    specialiste: 20000,
    professeur: 30000,
  };

  it("should return price from grid for generaliste", () => {
    const doctor = { category: "generaliste" as const };
    const price = resolveConsultationPrice(doctor, testGrid);
    expect(price).toBe(10000);
  });

  it("should return price from grid for specialiste", () => {
    const doctor = { category: "specialiste" as const };
    const price = resolveConsultationPrice(doctor, testGrid);
    expect(price).toBe(20000);
  });

  it("should return price from grid for professeur", () => {
    const doctor = { category: "professeur" as const };
    const price = resolveConsultationPrice(doctor, testGrid);
    expect(price).toBe(30000);
  });

  it("should use DEFAULT_PRICING_GRID when grid is null", () => {
    const doctor = { category: "specialiste" as const };
    const price = resolveConsultationPrice(doctor, null);
    expect(price).toBe(DEFAULT_PRICING_GRID.specialiste);
  });

  it("should use DEFAULT_PRICING_GRID when grid is undefined", () => {
    const doctor = { category: "generaliste" as const };
    const price = resolveConsultationPrice(doctor, undefined);
    expect(price).toBe(DEFAULT_PRICING_GRID.generaliste);
  });

  it("should handle all three categories correctly", () => {
    const categories = ["generaliste", "specialiste", "professeur"] as const;
    const expectedPrices = [10000, 20000, 30000];

    categories.forEach((cat, idx) => {
      const doctor = { category: cat };
      const price = resolveConsultationPrice(doctor, testGrid);
      expect(price).toBe(expectedPrices[idx]);
    });
  });
});
