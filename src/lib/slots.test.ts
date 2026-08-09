import { describe, expect, it } from "vitest";
import {
  availableSlotTimes,
  defaultSlotsForDay,
  isBusy,
  isDateInRange,
  minutesToTime,
  scheduleSlotsForDay,
  slotsBetween,
  timeToMinutes,
  weekdayOf,
} from "./slots";

describe("weekdayOf", () => {
  it("maps a yyyy-MM-dd key to JS getDay() (0 = dimanche … 6 = samedi)", () => {
    expect(weekdayOf("2026-08-08")).toBe(6); // samedi
    expect(weekdayOf("2026-08-09")).toBe(0); // dimanche
    expect(weekdayOf("2026-08-10")).toBe(1); // lundi
  });
});

describe("time helpers", () => {
  it("converts HH:mm to minutes since midnight", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("00:00")).toBe(0);
  });

  it("formats minutes back to HH:mm", () => {
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(0)).toBe("00:00");
  });
});

describe("isDateInRange (off-day rule)", () => {
  it("includes the start and end dates (inclusive range)", () => {
    expect(isDateInRange("2026-08-10", "2026-08-10", "2026-08-14")).toBe(true);
    expect(isDateInRange("2026-08-14", "2026-08-10", "2026-08-14")).toBe(true);
    expect(isDateInRange("2026-08-12", "2026-08-10", "2026-08-14")).toBe(true);
  });

  it("excludes dates outside the range", () => {
    expect(isDateInRange("2026-08-09", "2026-08-10", "2026-08-14")).toBe(false);
    expect(isDateInRange("2026-08-15", "2026-08-10", "2026-08-14")).toBe(false);
  });

  it("handles a single-day off period", () => {
    expect(isDateInRange("2026-08-11", "2026-08-11", "2026-08-11")).toBe(true);
    expect(isDateInRange("2026-08-12", "2026-08-11", "2026-08-11")).toBe(false);
  });
});

describe("defaultSlotsForDay", () => {
  it("closes on Sunday", () => {
    expect(defaultSlotsForDay(0)).toEqual([]);
  });

  it("offers mornings only on Saturday", () => {
    const slots = defaultSlotsForDay(6);
    expect(slots).toContain(timeToMinutes("09:00"));
    expect(slots).not.toContain(timeToMinutes("14:00"));
  });

  it("offers mornings and afternoons on weekdays", () => {
    const slots = defaultSlotsForDay(1);
    expect(slots).toContain(timeToMinutes("09:00"));
    expect(slots).toContain(timeToMinutes("14:00"));
    expect(slots).toContain(timeToMinutes("17:30"));
  });
});

describe("slotsBetween", () => {
  it("generates 30-minute starts inside [start, end)", () => {
    expect(slotsBetween(540, 660)).toEqual([540, 570, 600, 630]); // 09:00–11:00
  });

  it("returns nothing for an invalid or empty range", () => {
    expect(slotsBetween(660, 540)).toEqual([]);
    expect(slotsBetween(540, 540)).toEqual([]);
  });
});

describe("scheduleSlotsForDay", () => {
  it("honors the doctor's schedule for the matching weekday", () => {
    const schedule = [{ day: 1, start: "09:00", end: "10:30" }];
    expect(scheduleSlotsForDay(schedule, 1).map(minutesToTime)).toEqual([
      "09:00",
      "09:30",
      "10:00",
    ]);
  });

  it("combines several entries of the same day", () => {
    const schedule = [
      { day: 1, start: "09:00", end: "10:00" },
      { day: 1, start: "14:00", end: "15:00" },
    ];
    expect(scheduleSlotsForDay(schedule, 1).map(minutesToTime)).toEqual([
      "09:00",
      "09:30",
      "14:00",
      "14:30",
    ]);
  });

  it("offers no slot on a day absent from the schedule", () => {
    const schedule = [{ day: 1, start: "09:00", end: "10:00" }];
    expect(scheduleSlotsForDay(schedule, 2)).toEqual([]);
  });

  it("falls back to the clinic default hours without a fiche", () => {
    expect(scheduleSlotsForDay(null, 0)).toEqual([]); // dimanche fermé
    expect(scheduleSlotsForDay(undefined, 1)).toContain(timeToMinutes("14:00"));
    expect(scheduleSlotsForDay([], 6)).not.toContain(timeToMinutes("14:00"));
  });
});

describe("isBusy", () => {
  it("blocks a slot fully contained in a busy interval", () => {
    expect(isBusy(540, [{ start: 540, end: 570 }])).toBe(true); // 09:00 vs 09:00–09:30
  });

  it("frees a slot that starts exactly when the previous one ends", () => {
    expect(isBusy(570, [{ start: 540, end: 570 }])).toBe(false); // 09:30 vs 09:00–09:30
  });

  it("blocks partial overlaps", () => {
    expect(isBusy(540, [{ start: 555, end: 615 }])).toBe(true); // 09:00 vs 09:15–10:15
  });

  it("returns false with no busy intervals", () => {
    expect(isBusy(540, [])).toBe(false);
  });
});

describe("availableSlotTimes", () => {
  const schedule = [{ day: 1, start: "09:00", end: "10:00" }];
  const base = {
    schedule,
    busy: [] as { start: number; end: number }[],
    date: "2026-08-10", // lundi
    todayKey: "2026-08-08", // samedi (jour différent)
    nowMinutes: 0,
  };

  it("offers no slot at all on an off day", () => {
    expect(availableSlotTimes({ ...base, offDay: true })).toEqual([]);
  });

  it("lists the schedule slots when free", () => {
    expect(availableSlotTimes({ ...base, offDay: false })).toEqual([
      "09:00",
      "09:30",
    ]);
  });

  it("removes the slots overlapping a booked appointment", () => {
    expect(
      availableSlotTimes({
        ...base,
        offDay: false,
        busy: [{ start: 540, end: 570 }], // 09:00 occupé
      }),
    ).toEqual(["09:30"]);
  });

  it("hides the past slots when booking for today", () => {
    // Samedi (day 6) avec créneaux 09:00–10:00. À 09:15 (555 min),
    // le créneau 09:00 est passé, 09:30 reste libre.
    const saturday = [{ day: 6, start: "09:00", end: "10:00" }];
    expect(
      availableSlotTimes({
        ...base,
        offDay: false,
        schedule: saturday,
        date: "2026-08-08",
        todayKey: "2026-08-08",
        nowMinutes: 555,
      }),
    ).toEqual(["09:30"]);
  });

  it("closes on Sunday when the doctor has no fiche", () => {
    expect(
      availableSlotTimes({
        ...base,
        offDay: false,
        schedule: null,
        date: "2026-08-09", // dimanche
      }),
    ).toEqual([]);
  });
});
