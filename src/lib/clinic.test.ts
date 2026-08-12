import { describe, expect, it } from "vitest";
import {
  appointmentPrice,
  computeAge,
  doctorWorksOn,
  formatVitalSigns,
  toDateKey,
} from "./clinic";

describe("toDateKey", () => {
  it("formats a local date as yyyy-MM-dd", () => {
    expect(toDateKey(new Date(2026, 7, 8))).toBe("2026-08-08");
  });

  it("pads months and days", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("computeAge", () => {
  it("returns null for an invalid birth date", () => {
    expect(computeAge("nope")).toBeNull();
  });

  it("computes the age in whole years", () => {
    const age = computeAge("1990-05-10");
    expect(age).not.toBeNull();
    // In August 2026, someone born in May 1990 is 36.
    expect(age).toBeGreaterThanOrEqual(35);
    expect(age).toBeLessThanOrEqual(36);
  });
});

describe("formatVitalSigns", () => {
  it("joins the recorded constants with separators", () => {
    expect(
      formatVitalSigns({
        weight: 71,
        height: 170,
        bloodPressure: "12/8",
        temperature: 36.8,
      }),
    ).toBe("71 kg · 170 cm · TA 12/8 · 36,8 °C");
  });

  it("returns null when nothing was recorded", () => {
    expect(formatVitalSigns({})).toBeNull();
  });
});

describe("appointmentPrice", () => {
  it("uses the doctor category from the pricing grid", () => {
    const grid = {
      generaliste: 10000,
      specialiste: 20000,
      professeur: 30000,
    };
    expect(
      appointmentPrice({
        doctor: { category: "professeur" },
        service: { price: 5000 },
      } as never,
        grid,
      ),
    ).toBe(30000);
  });

  it("returns 0 when the doctor or service is missing", () => {
    expect(
      appointmentPrice({
        doctor: null,
        service: { price: 20000 },
      } as never),
    ).toBe(0);
  });

  it("uses the pricing grid category when provided", () => {
    const grid = {
      generaliste: 10000,
      specialiste: 20000,
      professeur: 30000,
    };
    expect(
      appointmentPrice(
        {
          doctor: { category: "professeur" },
          service: { price: 5000, isGeneralist: false },
        } as never,
        grid,
      ),
    ).toBe(30000);
  });

  it("returns 0 when the doctor or service is missing", () => {
    expect(appointmentPrice({ doctor: null, service: null } as never)).toBe(
      0,
    );
  });
});

describe("doctorWorksOn", () => {
  it("falls back to the clinic default (closed Sundays) without a fiche", () => {
    expect(doctorWorksOn(null, 0)).toBe(false);
    expect(doctorWorksOn(undefined, 1)).toBe(true);
  });

  it("honors the fiche schedule", () => {
    const schedule = [{ day: 1, start: "09:00", end: "17:00" }];
    expect(doctorWorksOn(schedule, 1)).toBe(true);
    expect(doctorWorksOn(schedule, 2)).toBe(false);
  });
});
