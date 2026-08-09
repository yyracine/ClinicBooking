import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import {
  DatabaseReader,
  DatabaseWriter,
  mutation,
  query,
} from "./_generated/server";

/**
 * Clinic-wide settings (key/value rows in the `clinicSettings` table).
 *
 * The shared staff password lets the clinic team sign into the planning with
 * a single password (test default: `admin123`). It can be changed at any time
 * from the staff dashboard — the stored value is used at every login.
 */

export const STAFF_PASSWORD_KEY = "staffPassword";
export const STAFF_PASSWORD_DEFAULT = "admin123";

/** Current shared staff password (falls back to the test default). */
export async function getStaffPassword(db: DatabaseReader): Promise<string> {
  const row = await db
    .query("clinicSettings")
    .withIndex("by_key", (q) => q.eq("key", STAFF_PASSWORD_KEY))
    .unique();
  return row?.value ?? STAFF_PASSWORD_DEFAULT;
}

export async function setStaffPassword(db: DatabaseWriter, password: string) {
  const row = await db
    .query("clinicSettings")
    .withIndex("by_key", (q) => q.eq("key", STAFF_PASSWORD_KEY))
    .unique();
  if (row) {
    await db.patch(row._id, { value: password });
  } else {
    await db.insert("clinicSettings", {
      key: STAFF_PASSWORD_KEY,
      value: password,
    });
  }
}

/**
 * Whether the provided password is the current shared staff password.
 * Used by the staff login provider (a plain login check, safe to expose).
 */
export const staffPasswordMatches = query({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    return args.password === (await getStaffPassword(ctx.db));
  },
});

/** Staff: change the shared planning password (e.g. after the test period). */
export const updateStaffPassword = mutation({
  args: { currentPassword: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Vous devez être connecté.");
    }
    const user = await ctx.db.get<"users">(userId);
    if (user?.role !== "staff") {
      throw new Error("Accès réservé à l'administration de la clinique.");
    }
    if (args.currentPassword !== (await getStaffPassword(ctx.db))) {
      throw new Error("Le mot de passe actuel est incorrect.");
    }
    if (args.newPassword.length < 8) {
      throw new Error(
        "Le nouveau mot de passe doit contenir au moins 8 caractères.",
      );
    }
    await setStaffPassword(ctx.db, args.newPassword);
  },
});
