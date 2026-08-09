import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { QueryCtx, query } from "./_generated/server";
import {
  availableSlotTimes,
  isDateInRange,
  timeToMinutes,
  toDateKey,
} from "../lib/slots";

/**
 * Catalog queries: medical services, practitioners, and real-time slot
 * availability for a given doctor + date.
 *
 * The pure slot rules (off days, schedules, default hours, overlap) live in
 * `src/lib/slots.ts` and are unit-tested there; this module only handles the
 * Convex database access.
 */

type DbCtx = Pick<QueryCtx, "db">;

/**
 * Whether the doctor is off on the given date (congés / indisponibilités
 * declared by the staff). Inclusive range: [startDate, endDate].
 */
async function isDoctorOffDay(
  ctx: DbCtx,
  doctorId: Id<"doctors">,
  date: string,
): Promise<boolean> {
  const periods = await ctx.db
    .query("doctorOffDays")
    .withIndex("by_doctor", (q) => q.eq("doctorId", doctorId))
    .collect();
  return periods.some((p) => isDateInRange(date, p.startDate, p.endDate));
}

/**
 * Compute the list of available start times ("HH:mm") for a doctor on a date.
 * Shared by the `availableSlots` query and the `bookAppointment` mutation so
 * the availability check is always authoritative.
 */
export async function computeAvailableSlots(
  ctx: DbCtx,
  doctorId: Id<"doctors">,
  date: string,
): Promise<string[]> {
  const [offDay, doctor, appointments] = await Promise.all([
    isDoctorOffDay(ctx, doctorId, date),
    ctx.db.get(doctorId),
    ctx.db
      .query("appointments")
      .withIndex("by_doctor_date", (q) =>
        q.eq("doctorId", doctorId).eq("date", date),
      )
      .filter((q) => q.neq(q.field("status"), "cancelled"))
      .collect(),
  ]);

  // Busy intervals: each booked appointment occupies [start, start + duration)
  const busy: { start: number; end: number }[] = [];
  for (const a of appointments) {
    const service = await ctx.db.get(a.serviceId);
    const start = timeToMinutes(a.time);
    busy.push({ start, end: start + (service?.durationMinutes ?? 30) });
  }

  const now = new Date();
  return availableSlotTimes({
    offDay,
    schedule: doctor?.schedule,
    busy,
    date,
    todayKey: toDateKey(now),
    nowMinutes: now.getHours() * 60 + now.getMinutes(),
  });
}

export const listServices = query({
  args: {},
  handler: async (ctx) => {
    const services = await ctx.db.query("services").collect();
    return services.sort((a, b) => a._creationTime - b._creationTime);
  },
});

export const listDoctors = query({
  args: {},
  handler: async (ctx) => {
    const doctors = await ctx.db.query("doctors").collect();
    return doctors.sort((a, b) => a._creationTime - b._creationTime);
  },
});

export const availableSlots = query({
  args: { doctorId: v.id("doctors"), date: v.string() },
  handler: async (ctx, args) => {
    return computeAvailableSlots(ctx, args.doctorId, args.date);
  },
});
