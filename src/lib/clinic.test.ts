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
  it("prefers the tariff set on the doctor fiche", () => {
    expect(
      appointmentPrice({
        doctor: { consultationPrice: 30000 },
        service: { price: 20000 },
      } as never),
    ).toBe(30000);
  });

  it("falls back to the service price", () => {
    expect(
      appointmentPrice({
        doctor: {},
        service: { price: 20000 },
      } as never),
    ).toBe(20000);
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
