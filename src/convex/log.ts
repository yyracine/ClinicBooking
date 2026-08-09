import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { MutationCtx, query } from "./_generated/server";

/**
 * Activity log (audit trail): every important action of the clinic is
 * recorded with the actor, a machine key and a human-readable label.
 */

/** Insert one activity log entry (used inside mutations). */
export async function logActivity(
  ctx: Pick<MutationCtx, "db">,
  entry: {
    actorId?: Id<"users">;
    action: string;
    label: string;
    details?: string;
  },
) {
  await ctx.db.insert("activityLogs", {
    actorId: entry.actorId,
    action: entry.action,
    label: entry.label,
    details: entry.details,
  });
}

/** Staff: the latest activity entries, most recent first. */
export const listActivityLogs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Non connecté.");
    const user = await ctx.db.get<"users">(userId);
    if (user?.role !== "staff" || user?.disabled === true) {
      throw new Error("Accès réservé à l'administration de la clinique.");
    }

    const rows = await ctx.db.query("activityLogs").order("desc").take(100);

    return Promise.all(
      rows.map(async (r) => ({
        _id: r._id,
        action: r.action,
        label: r.label,
        details: r.details ?? null,
        createdAt: r._creationTime,
        actor: r.actorId ? ((await ctx.db.get(r.actorId))?.name ?? null) : null,
      })),
    );
  },
});
