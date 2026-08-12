import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { PricingGrid } from "../lib/pricing";
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

/**
 * Grille tarifaire de la consultation (4 catégories), gérée par
 * l'administration. Stockée comme une ligne JSON dans `clinicSettings`,
 * même principe que le mot de passe partagé ci-dessus.
 */

export const PRICING_GRID_KEY = "pricingGrid";

/** Current pricing grid, or null when the administration hasn't set it yet. */
export async function getPricingGrid(
  db: DatabaseReader,
): Promise<PricingGrid | null> {
  const row = await db
    .query("clinicSettings")
    .withIndex("by_key", (q) => q.eq("key", PRICING_GRID_KEY))
    .unique();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as PricingGrid;
  } catch {
    return null;
  }
}

export async function setPricingGrid(db: DatabaseWriter, grid: PricingGrid) {
  const row = await db
    .query("clinicSettings")
    .withIndex("by_key", (q) => q.eq("key", PRICING_GRID_KEY))
    .unique();
  const value = JSON.stringify(grid);
  if (row) {
    await db.patch(row._id, { value });
  } else {
    await db.insert("clinicSettings", { key: PRICING_GRID_KEY, value });
  }
}

/** Current pricing grid (null if not yet configured by the administration). */
export const pricingGrid = query({
  args: {},
  handler: async (ctx) => {
    return await getPricingGrid(ctx.db);
  },
});

function cleanGridValue(value: number, label: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new Error(
      `Indiquez un tarif valide (FCFA, sans décimales) pour ${label}.`,
    );
  }
  return value;
}

/** Staff: set the 3-category consultation pricing grid. */
export const updatePricingGrid = mutation({
  args: {
    generaliste: v.number(),
    specialiste: v.number(),
    professeur: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Vous devez être connecté.");
    }
    const user = await ctx.db.get<"users">(userId);
    if (user?.role !== "staff") {
      throw new Error("Accès réservé à l'administration de la clinique.");
    }
    await setPricingGrid(ctx.db, {
      generaliste: cleanGridValue(args.generaliste, "Généraliste"),
      specialiste: cleanGridValue(args.specialiste, "Spécialiste"),
      professeur: cleanGridValue(args.professeur, "Professeur"),
    });
  },
});
