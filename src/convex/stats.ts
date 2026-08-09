import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";
import { computeDashboardStats } from "../lib/stats";

/**
 * Staff dashboard statistics (chiffre d'affaires, occupation, motifs…).
 * The aggregation is pure and unit-tested in src/lib/stats.ts; this query
 * only checks the staff role and feeds the data in.
 */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Non connecté.");
    const user = await ctx.db.get<"users">(userId);
    if (user?.role !== "staff" || user?.disabled === true) {
      throw new Error("Accès réservé à l'administration de la clinique.");
    }

    const [rows, doctors] = await Promise.all([
      ctx.db.query("appointments").collect(),
      ctx.db.query("doctors").collect(),
    ]);

    return computeDashboardStats(rows, doctors, new Date());
  },
});
