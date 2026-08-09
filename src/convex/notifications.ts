import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

/**
 * In-app notifications (cloche de notification) for patients and staff.
 *
 * Rows are inserted by the business flows themselves (a scheduled action via
 * `create`, or directly by a mutation that already holds the data). The
 * signed-in user reads their own notifications with `myNotifications` and
 * marks them as read with `markRead`.
 */

/**
 * Insert a notification for a user. Used by scheduled actions (rappel J-1,
 * confirmation…) that already know the recipient. Clients could call it too,
 * but it only ever writes a notification row — harmless by design.
 */
export const create = mutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    title: v.string(),
    body: v.string(),
    link: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      link: args.link,
      read: false,
    });
  },
});

/** The signed-in user's notifications, unread first then most recent. */
export const myNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return rows
      .sort((a, b) => {
        // Unread first, then most recent first (stable: original order kept).
        if (a.read !== b.read) return a.read ? 1 : -1;
        return b._creationTime - a._creationTime;
      })
      .slice(0, 50);
  },
});

/** Mark one notification as read — or all of them when no id is given. */
export const markRead = mutation({
  args: { id: v.optional(v.id("notifications")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;

    if (args.id) {
      const notification = await ctx.db.get(args.id);
      if (notification && notification.userId === userId && !notification.read) {
        await ctx.db.patch(args.id, { read: true });
      }
      return;
    }

    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const unread = rows.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) => ctx.db.patch(n._id, { read: true })),
    );
  },
});

export type NotificationId = Id<"notifications">;
