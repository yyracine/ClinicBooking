import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";
import { logActivity } from "./log";
import { hashPassword, verifyPassword } from "../lib/password";

/**
 * Individual staff accounts with roles (admin / médecin / accueil).
 *
 * The clinic team can still sign in with the shared password (see
 * `convex/auth/staff.ts`), but an admin can now create named accounts, each
 * with their own password and a role. Staff passwords are stored as
 * SHA-256 + random salt on the `users` row (never plaintext).
 *
 * Role model (v1): the role is displayed everywhere and only *admin* can
 * manage the team; the planning, patients and doctors views stay open to
 * every staff member.
 */

export const STAFF_ROLES = ["admin", "medecin", "accueil"] as const;
export const staffRoleValidator = v.union(
  v.literal("admin"),
  v.literal("medecin"),
  v.literal("accueil"),
);
export type StaffRole = (typeof STAFF_ROLES)[number];

const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Administrateur",
  medecin: "Médecin",
  accueil: "Accueil",
};

/** Human-readable label of a staff role ("Administrateur", …). */
export function staffRoleLabel(role: StaffRole | undefined | null): string {
  return role && role in STAFF_ROLE_LABELS
    ? STAFF_ROLE_LABELS[role]
    : "Administrateur"; // legacy staff accounts keep admin rights
}

/** Whether a user document has administrator rights on the team. */
export function isAdmin(user: {
  role?: string | null;
  staffRole?: string | null;
  disabled?: boolean | null;
}): boolean {
  return (
    user?.role === "staff" &&
    user?.disabled !== true &&
    (user?.staffRole == null || user?.staffRole === "admin")
  );
}

type AppCtx = QueryCtx | MutationCtx;

async function requireStaff(ctx: AppCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Vous devez être connecté.");
  }
  const user = await ctx.db.get<"users">(userId);
  if (user?.role !== "staff" || user?.disabled === true) {
    throw new Error("Accès réservé à l'administration de la clinique.");
  }
  return { userId, user };
}

async function requireAdmin(ctx: AppCtx) {
  const { userId, user } = await requireStaff(ctx);
  if (!isAdmin(user)) {
    throw new Error(
      "Cette action est réservée aux administrateurs de la clinique.",
    );
  }
  return userId;
}

/* ------------------------------------------------------------------ */
/* Password hashing — pure helpers in src/lib/password.ts (unit-tested) */
/* ------------------------------------------------------------------ */

/** Hash a staff password with a fresh random salt. */
export async function hashStaffPassword(
  password: string,
): Promise<{ hash: string; salt: string }> {
  return hashPassword(password);
}

/** Constant-time check of a staff password against its stored hash. */
export async function verifyStaffPassword(
  password: string,
  salt: string | undefined,
  hash: string | undefined,
): Promise<boolean> {
  return verifyPassword(password, salt, hash);
}

/** Find a staff account by identifier (e-mail or display name, CI). */
export async function findStaffByIdentifier(
  ctx: AppCtx,
  identifier: string,
): Promise<{ _id: Id<"users"> } | null> {
  const needle = identifier.trim().toLocaleLowerCase("fr");
  if (!needle) return null;

  const byEmail = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", needle))
    .first();
  if (byEmail && byEmail.role === "staff") return byEmail;

  // Fall back to a display-name match among staff accounts.
  const staffUsers = await ctx.db.query("users").collect();
  const byName = staffUsers.find(
    (u) =>
      u.role === "staff" &&
      (u.name ?? "").toLocaleLowerCase("fr") === needle,
  );
  return byName ?? null;
}

/* ------------------------------------------------------------------ */
/* Queries / mutations                                                 */
/* ------------------------------------------------------------------ */

/**
 * Login check used by the « staff » auth provider for individual accounts.
 * Returns the member id only when the identifier + password match. Safe to
 * expose: the id is unguessable and only usable with the correct password.
 */
export const verifyStaffLogin = query({
  args: {
    identifier: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const member = await findStaffByIdentifier(ctx, args.identifier);
    if (!member) return { ok: false };
    const user = await ctx.db.get<"users">(member._id);
    const ok = await verifyStaffPassword(
      args.password,
      user?.staffPasswordSalt,
      user?.staffPasswordHash,
    );
    if (!ok) return { ok: false };
    if (user?.disabled === true) return { ok: false, disabled: true };
    return { ok: true, userId: member._id };
  },
});

/** Internal: promote a legacy shared staff account to admin (idempotent). */
export const ensureStaffAdminRole = mutation({
  args: { memberId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get<"users">(args.memberId);
    if (user && user.role === "staff" && user.staffRole == null) {
      await ctx.db.patch(args.memberId, { staffRole: "admin" });
    }
  },
});

/**
 * Internal: refresh the display name of the shared team account when it
 * still carries the legacy « Personnel de la clinique » label (idempotent).
 */
export const refreshSharedStaffAccountName = mutation({
  args: { memberId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get<"users">(args.memberId);
    if (
      user &&
      user.role === "staff" &&
      user.name === "Personnel de la clinique"
    ) {
      await ctx.db.patch(args.memberId, {
        name: "Administration de la clinique",
      });
    }
  },
});

/** Staff: the list of team accounts, with roles and status. */
export const listStaffMembers = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);

    const rows = await ctx.db.query("users").collect();
    const members = rows
      .filter((u) => u.role === "staff")
      .map((u) => ({
        _id: u._id,
        name: u.name ?? "Sans nom",
        email: u.email ?? null,
        staffRole: u.staffRole ?? null,
        hasPassword: (u.staffPasswordHash?.length ?? 0) > 0,
        disabled: u.disabled === true,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));

    return members;
  },
});

/** Staff: create an individual team account (admin only). */
export const createStaffMember = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    role: staffRoleValidator,
    password: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const name = args.name.trim();
    if (name.length < 2) {
      throw new Error("Le nom du membre doit contenir au moins 2 caractères.");
    }
    if (args.password.length < 8) {
      throw new Error(
        "Le mot de passe doit contenir au moins 8 caractères.",
      );
    }

    const rows = await ctx.db.query("users").collect();
    const staffUsers = rows.filter((u) => u.role === "staff");
    const needle = name.toLocaleLowerCase("fr");
    const emailNeedle = args.email?.trim().toLocaleLowerCase("fr");
    if (
      staffUsers.some((u) => (u.name ?? "").toLocaleLowerCase("fr") === needle)
    ) {
      throw new Error("Un membre de l'équipe porte déjà ce nom.");
    }
    if (
      emailNeedle &&
      staffUsers.some(
        (u) => (u.email ?? "").toLocaleLowerCase("fr") === emailNeedle,
      )
    ) {
      throw new Error("Un membre de l'équipe utilise déjà cette adresse.");
    }

    const { hash, salt } = await hashStaffPassword(args.password);
    const id = await ctx.db.insert("users", {
      name,
      email: args.email?.trim() || undefined,
      role: "staff",
      staffRole: args.role,
      staffPasswordHash: hash,
      staffPasswordSalt: salt,
    });

    await logActivity(ctx, {
      actorId: (await getAuthUserId(ctx)) ?? undefined,
      action: "staff.created",
      label: "Membre de l'équipe créé",
      details: `${name} (${staffRoleLabel(args.role)})`,
    });

    return id;
  },
});

/** Staff: update a team account — role, activation (admin only). */
export const updateStaffMember = mutation({
  args: {
    memberId: v.id("users"),
    role: v.optional(staffRoleValidator),
    disabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const member = await ctx.db.get<"users">(args.memberId);
    if (!member || member.role !== "staff") {
      throw new Error("Membre de l'équipe introuvable.");
    }

    if (args.disabled === true && args.memberId === adminId) {
      throw new Error("Vous ne pouvez pas désactiver votre propre compte.");
    }

    // Never demote the last admin: keep at least one administrator.
    if (args.role === "medecin" || args.role === "accueil") {
      const admins = (
        await ctx.db.query("users").collect()
      ).filter((u) => isAdmin(u));
      if (
        admins.length <= 1 &&
        admins.some((u) => u._id === args.memberId)
      ) {
        throw new Error(
          "Impossible de retirer le dernier administrateur de l'équipe.",
        );
      }
    }

    await ctx.db.patch(args.memberId, {
      staffRole: args.role,
      disabled: args.disabled,
    });

    await logActivity(ctx, {
      actorId: adminId,
      action: "staff.updated",
      label: "Compte de l'équipe modifié",
      details: member.name ?? undefined,
    });
  },
});

/** Staff: reset the password of a team account (admin only). */
export const resetStaffPassword = mutation({
  args: { memberId: v.id("users"), password: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (args.password.length < 8) {
      throw new Error(
        "Le mot de passe doit contenir au moins 8 caractères.",
      );
    }
    const member = await ctx.db.get<"users">(args.memberId);
    if (!member || member.role !== "staff") {
      throw new Error("Membre de l'équipe introuvable.");
    }

    const { hash, salt } = await hashStaffPassword(args.password);
    await ctx.db.patch(args.memberId, {
      staffPasswordHash: hash,
      staffPasswordSalt: salt,
    });

    await logActivity(ctx, {
      actorId: (await getAuthUserId(ctx)) ?? undefined,
      action: "staff.password-reset",
      label: "Mot de passe du membre réinitialisé",
      details: member.name ?? undefined,
    });
  },
});
