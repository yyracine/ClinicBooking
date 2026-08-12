import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

/**
 * One-time migration: Convert doctor.academicRank + service.isGeneralist → doctor.category
 *
 * Rules:
 * - If academicRank === "professeur" → category = "professeur"
 * - Else if service.isGeneralist === true → category = "generaliste"
 * - Else → category = "specialiste"
 *
 * Run this once after deploying the schema change.
 * After running, you can delete this file.
 */
export const migrateDoctorCategories = mutation({
  args: {},
  async handler(ctx) {
    // Check auth: staff only
    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_id", (q) => q.eq("_id", userId.subject as Id<"users">))
      .first();
    if (user?.role !== "staff") {
      throw new Error("Unauthorized: staff role required");
    }

    // Fetch all doctors
    const doctors = await ctx.db.query("doctors").collect();

    let migratedCount = 0;

    for (const doctor of doctors) {
      // Skip if already has category (already migrated)
      if ("category" in doctor && doctor.category) {
        continue;
      }

      // Determine category
      let category: "generaliste" | "specialiste" | "professeur" = "specialiste";

      const academicRank = "academicRank" in doctor ? doctor.academicRank : "medecin";
      if (academicRank === "professeur") {
        category = "professeur";
      } else {
        // Fetch the service to check isGeneralist
        const service = await ctx.db.get(doctor.serviceId);
        if (service?.isGeneralist === true) {
          category = "generaliste";
        }
      }

      // Update doctor with category, remove old fields
      await ctx.db.patch(doctor._id, {
        category,
        // Note: Convex doesn't have an explicit "unset" for optional fields,
        // so we don't explicitly remove academicRank/consultationPrice here.
        // The schema will ignore them on read.
      });

      migratedCount++;
    }

    return {
      success: true,
      migratedCount,
      message: `Migrated ${migratedCount} doctors to new category model`,
    };
  },
});
