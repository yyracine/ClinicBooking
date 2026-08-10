import { describe, expect, it } from "vitest";
import {
  computePatientShare,
  resolveConsultationPrice,
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
  const GRID: PricingGrid = {
    generalisteMedecin: 10000,
    generalisteProfesseur: 15000,
    specialisteMedecin: 20000,
    specialisteProfesseur: 30000,
  };

  it("généraliste + médecin (grade par défaut)", () => {
    expect(
      resolveConsultationPrice({}, { price: 5000, isGeneralist: true }, GRID),
    ).toBe(10000);
  });

  it("généraliste + professeur", () => {
    expect(
      resolveConsultationPrice(
        { academicRank: "professeur" },
        { price: 5000, isGeneralist: true },
        GRID,
      ),
    ).toBe(15000);
  });

  it("spécialiste + médecin (isGeneralist absent = spécialiste)", () => {
    expect(resolveConsultationPrice({}, { price: 5000 }, GRID)).toBe(20000);
  });

  it("spécialiste + professeur", () => {
    expect(
      resolveConsultationPrice(
        { academicRank: "professeur" },
        { price: 5000, isGeneralist: false },
        GRID,
      ),
    ).toBe(30000);
  });

  it("le tarif personnalisé du médecin prime toujours sur la grille", () => {
    expect(
      resolveConsultationPrice(
        { consultationPrice: 99000, academicRank: "professeur" },
        { price: 5000, isGeneralist: true },
        GRID,
      ),
    ).toBe(99000);
  });

  it("retombe sur le prix du service quand la grille est absente", () => {
    expect(resolveConsultationPrice({}, { price: 12000 }, null)).toBe(12000);
    expect(resolveConsultationPrice({}, { price: 12000 }, undefined)).toBe(
      12000,
    );
  });

  it("retombe sur le prix du service si une cellule de la grille est manquante", () => {
    const partial = { ...GRID, specialisteMedecin: undefined } as never;
    expect(resolveConsultationPrice({}, { price: 7000 }, partial)).toBe(7000);
  });
});
