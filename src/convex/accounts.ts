import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { MutationCtx, mutation } from "./_generated/server";

/**
 * Guest accounts: a visitor can start as an anonymous guest and create a full
 * account (email + password) afterwards. When they do, their fiche patient,
 * appointments and medical file are moved onto the new account so nothing is
 * lost.
 */

async function dataForUser(ctx: MutationCtx, userId: Id<"users">) {
  const [profile, appointments, visits] = await Promise.all([
    ctx.db
      .query("patientProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first(),
    ctx.db
      .query("appointments")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
    ctx.db
      .query("visits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
  ]);
  return { profile, appointments, visits };
}

/**
 * Called right after a guest signs up with email + password. Moves the data of
 * the former anonymous account onto the current (new) account and deletes the
 * anonymous user row.
 *
 * Guardrails:
 * - The source account must really be an anonymous (guest) account.
 * - When the guest has a fiche patient, its e-mail must match the e-mail used
 *   to create the account, so one person's record can never be claimed by
 *   someone else.
 */
export const mergeAnonymousAccount = mutation({
  args: { anonymousUserId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Vous devez être connecté pour effectuer cette action.");
    }
    if (args.anonymousUserId === userId) return;

    const anonymous = await ctx.db.get<"users">(args.anonymousUserId);
    if (!anonymous) return; // already cleaned up
    if (anonymous.isAnonymous !== true) {
      throw new Error("Ce compte n'est pas un compte invité.");
    }

    const { profile, appointments, visits } = await dataForUser(
      ctx,
      args.anonymousUserId,
    );

    // Only carry data over when the records can be attributed to the person
    // creating the account: the fiche e-mail (or the guest e-mail) must match
    // the account e-mail. Accounts without any data are merged freely.
    if (profile || appointments.length > 0 || visits.length > 0) {
      const me = await ctx.db.get<"users">(userId);
      const accountEmail = (me?.email ?? "").toLocaleLowerCase("fr");
      const recordEmail = (
        profile?.email ??
        anonymous.email ??
        ""
      ).toLocaleLowerCase("fr");

      if (!accountEmail || !recordEmail || recordEmail !== accountEmail) {
        throw new Error(
          "L'e-mail du compte ne correspond pas à celui de la fiche patient. Utilisez l'e-mail de votre fiche patient.",
        );
      }
    }

    if (profile) {
      const existing = await ctx.db
        .query("patientProfiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();
      if (existing) {
        throw new Error("Un dossier existe déjà sur ce compte.");
      }
      await ctx.db.patch(profile._id, { userId });
    }

    for (const appointment of appointments) {
      await ctx.db.patch(appointment._id, { userId });
    }
    for (const visit of visits) {
      await ctx.db.patch(visit._id, { userId });
    }

    // Carry over the chosen profile (patient / staff) so the upgraded user
    // doesn't have to pick it again.
    if (anonymous.role) {
      await ctx.db.patch(userId, { role: anonymous.role });
    }

    await ctx.db.delete(args.anonymousUserId);
  },
});
