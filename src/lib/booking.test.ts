import { describe, expect, it } from "vitest";
import {
  CANCEL_WINDOW_MS,
  DAY_MS,
  REMINDER_DAYS,
  REMINDER_LEAD_MS,
  canCancelFree,
  findWaitingEntry,
  isPastDateKey,
  isValidDateKey,
  nextDossierNumber,
  pickNextWaiting,
  reminderScheduleTime,
  reminderScheduleTimes,
  sortWaitingFifo,
  toE164,
} from "./booking";

/** Fixed "now" (local time, same format as `${date}T${time}`) for determinism. */
const NOW = Date.parse("2026-08-08T12:00:00");

describe("canCancelFree", () => {
  it("allows cancellation exactly 24 h before the appointment (boundary)", () => {
    const start = NOW + CANCEL_WINDOW_MS;
    const d = new Date(start);
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes(),
    ).padStart(2, "0")}`;
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(d.getDate()).padStart(2, "0")}`;
    expect(canCancelFree(date, time, NOW)).toBe(true);
  });

  it("allows cancellation more than 24 h before", () => {
    expect(canCancelFree("2026-08-09", "13:00", NOW)).toBe(true);
  });

  it("blocks cancellation less than 24 h before", () => {
    expect(canCancelFree("2026-08-09", "11:00", NOW)).toBe(false);
  });

  it("blocks cancellation within the final hour", () => {
    expect(canCancelFree("2026-08-08", "13:00", NOW)).toBe(false);
  });

  it("blocks cancellation once the appointment is in the past", () => {
    expect(canCancelFree("2026-08-07", "12:00", NOW)).toBe(false);
  });

  it("keeps cancellation allowed when the date cannot be parsed", () => {
    expect(canCancelFree("not-a-date", "12:00", NOW)).toBe(true);
  });
});

describe("pickNextWaiting", () => {
  it("returns null for an empty waiting list", () => {
    expect(pickNextWaiting([])).toBeNull();
  });

  it("returns the patient who asked first (FIFO), from unsorted input", () => {
    const entries = [
      { _id: "late", _creationTime: 300 },
      { _id: "first", _creationTime: 100 },
      { _id: "middle", _creationTime: 200 },
    ];
    expect(pickNextWaiting(entries)?._id).toBe("first");
  });

  it("does not mutate the input array", () => {
    const entries = [
      { _id: "b", _creationTime: 200 },
      { _id: "a", _creationTime: 100 },
    ];
    pickNextWaiting(entries);
    expect(entries.map((e) => e._id)).toEqual(["b", "a"]);
  });
});

describe("reminderScheduleTime (rappel J-1)", () => {
  it("fires exactly 24 h before the appointment", () => {
    const at = reminderScheduleTime("2026-08-09", "13:00", NOW);
    expect(at).toBe(Date.parse("2026-08-09T13:00") - REMINDER_LEAD_MS);
  });

  it("schedules when the appointment is more than 24 h away", () => {
    expect(reminderScheduleTime("2026-08-10", "09:00", NOW)).not.toBeNull();
  });

  it("skips when the appointment is exactly 24 h away (already at the deadline)", () => {
    expect(reminderScheduleTime("2026-08-09", "12:00", NOW)).toBeNull();
  });

  it("skips when the appointment is less than 24 h away", () => {
    expect(reminderScheduleTime("2026-08-09", "11:00", NOW)).toBeNull();
    expect(reminderScheduleTime("2026-08-08", "13:00", NOW)).toBeNull();
  });

  it("skips for an appointment already in the past", () => {
    expect(reminderScheduleTime("2026-08-07", "12:00", NOW)).toBeNull();
  });

  it("skips when the date/time cannot be parsed", () => {
    expect(reminderScheduleTime("not-a-date", "12:00", NOW)).toBeNull();
  });
});

describe("reminderScheduleTimes (rappels multiples J-7 / J-3 / J-1)", () => {
  it("schedules every lead exactly N days before the appointment", () => {
    const schedule = reminderScheduleTimes("2026-08-16", "09:00", NOW);
    const appointmentMs = Date.parse("2026-08-16T09:00");
    expect(schedule.map((s) => s.daysBefore)).toEqual([7, 3, 1]);
    for (const s of schedule) {
      expect(s.runAt).toBe(appointmentMs - s.daysBefore * DAY_MS);
    }
  });

  it("returns the schedule from the farthest to the closest reminder", () => {
    const schedule = reminderScheduleTimes("2026-08-16", "09:00", NOW);
    expect(schedule[0].runAt).toBeLessThan(schedule[1].runAt);
    expect(schedule[1].runAt).toBeLessThan(schedule[2].runAt);
  });

  it("drops the leads whose firing moment is already in the past", () => {
    // Appointment 2026-08-12 09:00 — J-7 (08-05) is gone, J-3 and J-1 remain.
    const schedule = reminderScheduleTimes("2026-08-12", "09:00", NOW);
    expect(schedule.map((s) => s.daysBefore)).toEqual([3, 1]);
  });

  it("drops every lead when only the J-1 moment is left at the boundary", () => {
    // J-1 fires exactly at `now` — by convention it is already too late.
    const schedule = reminderScheduleTimes("2026-08-09", "12:00", NOW);
    expect(schedule).toEqual([]);
  });

  it("returns an empty schedule for an appointment in the past", () => {
    expect(reminderScheduleTimes("2026-08-07", "12:00", NOW)).toEqual([]);
  });

  it("returns an empty schedule when the date/time cannot be parsed", () => {
    expect(reminderScheduleTimes("not-a-date", "12:00", NOW)).toEqual([]);
  });

  it("keeps the same firing rule as the single J-1 reminder", () => {
    const one = reminderScheduleTime("2026-08-09", "13:00", NOW);
    const many = reminderScheduleTimes("2026-08-09", "13:00", NOW);
    expect(many.find((s) => s.daysBefore === 1)?.runAt).toBe(one);
    expect(REMINDER_DAYS).toEqual([7, 3, 1]);
  });
});

describe("toE164 (normalisation des téléphones pour SMS)", () => {
  it("adds the default country code to a leading-zero local number", () => {
    expect(toE164("06 12 34 56 78")).toBe("+2250612345678");
  });

  it("keeps an already international number", () => {
    expect(toE164("+225 06 12 34 56 78")).toBe("+2250612345678");
  });

  it("rewrites the 00 prefix to +", () => {
    expect(toE164("00225 06 12 34 56 78")).toBe("+2250612345678");
  });

  it("strips formatting characters", () => {
    expect(toE164("+1 (555) 123-4567")).toBe("+15551234567");
    expect(toE164("07 01.02 03 04")).toBe("+2250701020304");
  });

  it("honors a custom default country code", () => {
    // Leading zero kept (CI format); the code applies to any country code.
    expect(toE164("06 12 34 56 78", "33")).toBe("+330612345678");
    expect(toE164("512345678", "221")).toBe("+221512345678");
  });

  it("returns null for empty or unparsable numbers", () => {
    expect(toE164("")).toBeNull();
    expect(toE164("abc")).toBeNull();
    expect(toE164("   ")).toBeNull();
  });

  it("rejects numbers that are too short to be valid", () => {
    expect(toE164("123")).toBeNull();
    expect(toE164("+225 12")).toBeNull();
  });
});

describe("isValidDateKey", () => {
  it("accepts a well-formed yyyy-MM-dd key", () => {
    expect(isValidDateKey("2026-08-08")).toBe(true);
  });

  it("rejects malformed formats", () => {
    for (const bad of [
      "08-08-2026",
      "2026/08/08",
      "2026-8-8",
      "2026-08-08T10:00",
      "20260808",
      "2026-08-08 ",
      "",
      "lundi",
    ]) {
      expect(isValidDateKey(bad), bad).toBe(false);
    }
  });

  it("rejects impossible calendar dates", () => {
    for (const bad of ["2026-13-01", "2026-00-10", "2026-08-00", "2026-02-30"]) {
      expect(isValidDateKey(bad), bad).toBe(false);
    }
  });

  it("honors leap years", () => {
    expect(isValidDateKey("2024-02-29")).toBe(true); // 2024 is a leap year
    expect(isValidDateKey("2026-02-29")).toBe(false); // 2026 is not
  });
});

describe("isPastDateKey", () => {
  const TODAY = "2026-08-08";

  it("flags a date strictly before today", () => {
    expect(isPastDateKey("2026-08-07", TODAY)).toBe(true);
    expect(isPastDateKey("2026-01-01", TODAY)).toBe(true);
  });

  it("still allows booking for today itself", () => {
    expect(isPastDateKey(TODAY, TODAY)).toBe(false);
  });

  it("allows future dates", () => {
    expect(isPastDateKey("2026-08-09", TODAY)).toBe(false);
    expect(isPastDateKey("2027-12-31", TODAY)).toBe(false);
  });
});

describe("findWaitingEntry (no-duplicate rule)", () => {
  const entries = [
    { _id: "a", doctorId: "doc1", date: "2026-08-10", userId: "u1" },
    { _id: "b", doctorId: "doc1", date: "2026-08-11", userId: "u1" },
    { _id: "c", doctorId: "doc2", date: "2026-08-10", userId: "u1" },
    { _id: "d", doctorId: "doc1", date: "2026-08-10", userId: "u2" },
  ];

  it("returns null for an empty waiting list", () => {
    expect(findWaitingEntry([], "doc1", "2026-08-10", "u1")).toBeNull();
  });

  it("finds the entry when the patient already waits for this doctor on this date", () => {
    expect(findWaitingEntry(entries, "doc1", "2026-08-10", "u1")?._id).toBe(
      "a",
    );
  });

  it("is not a duplicate when the same patient waits for the same doctor on another date", () => {
    expect(findWaitingEntry(entries, "doc1", "2026-08-11", "u1")?._id).toBe(
      "b",
    );
    // …and the original request for a different date stays distinct.
    expect(findWaitingEntry(entries, "doc1", "2026-08-12", "u1")).toBeNull();
  });

  it("is not a duplicate when the same patient waits for another doctor on the same date", () => {
    expect(findWaitingEntry(entries, "doc2", "2026-08-10", "u1")?._id).toBe(
      "c",
    );
    expect(findWaitingEntry(entries, "doc9", "2026-08-10", "u1")).toBeNull();
  });

  it("is not a duplicate when another patient waits for the same doctor on the same date", () => {
    expect(findWaitingEntry(entries, "doc1", "2026-08-10", "u2")?._id).toBe(
      "d",
    );
    expect(findWaitingEntry(entries, "doc1", "2026-08-10", "u3")).toBeNull();
  });
});

describe("sortWaitingFifo", () => {
  it("orders the entries oldest first", () => {
    const sorted = sortWaitingFifo([
      { _id: "c", _creationTime: 300 },
      { _id: "a", _creationTime: 100 },
      { _id: "b", _creationTime: 200 },
    ]);
    expect(sorted.map((e) => e._id)).toEqual(["a", "b", "c"]);
  });

  it("returns a new array and keeps the input untouched", () => {
    const entries = [
      { _id: "b", _creationTime: 200 },
      { _id: "a", _creationTime: 100 },
    ];
    const sorted = sortWaitingFifo(entries);
    expect(sorted).not.toBe(entries);
    expect(entries.map((e) => e._id)).toEqual(["b", "a"]);
  });

  it("handles an empty list", () => {
    expect(sortWaitingFifo([])).toEqual([]);
  });
});

describe("nextDossierNumber", () => {
  it("starts at D-0001 when no fiche exists yet", () => {
    expect(nextDossierNumber([])).toBe("D-0001");
  });

  it("increments the highest existing number, padded to 4 digits", () => {
    expect(nextDossierNumber(["D-0001", "D-0002", "D-0003"])).toBe("D-0004");
  });

  it("never reuses a number freed by a deletion", () => {
    // D-0002 was deleted: the next number is D-0004, not D-0002.
    expect(nextDossierNumber(["D-0001", "D-0003", "D-0004"])).toBe("D-0005");
  });

  it("ignores the demo D-900x range so real fiches stay in D-000x", () => {
    expect(nextDossierNumber(["D-0001", "D-9001", "D-9002"])).toBe("D-0002");
  });

  it("handles unsorted input and higher-padded numbers", () => {
    expect(nextDossierNumber(["D-0012", "D-0003", "D-0007"])).toBe("D-0013");
  });

  it("ignores malformed dossier numbers", () => {
    expect(nextDossierNumber(["D-abc", "x-0001", ""])).toBe("D-0001");
  });
});
