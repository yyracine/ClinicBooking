import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount } from "@convex-dev/auth/server";
import { api } from "../_generated/api";
import { Id } from "../_generated/dataModel";

/**
 * Staff password provider.
 *
 * Two ways to sign into the planning:
 *  1. An individual account (created by an admin in « Équipe »): send
 *     `identifier` (e-mail or display name) + the member's own password
 *     (verified by `api.staff.verifyStaffLogin`);
 *  2. The legacy shared password (test default `admin123`), validated
 *     server-side against `clinicSettings`. The first valid login provisions
 *     a shared staff account with the `staff` role and admin rights.
 */

/** Hidden account shared by the whole clinic team. */
export const STAFF_EMAIL = "equipe@clinic-bookings.local";

export const staff = ConvexCredentials({
  id: "staff",
  authorize: async (
    params,
    ctx,
  ): Promise<{ userId: Id<"users"> }> => {
    const password = params.password;
    if (typeof password !== "string" || password.length === 0) {
      throw new Error("Saisissez le mot de passe de l'administration.");
    }

    // 1. Individual staff account (identifier + personal password).
    const identifier = params.identifier;
    if (typeof identifier === "string" && identifier.trim().length > 0) {
      const check: {
        ok: boolean;
        userId?: Id<"users">;
        disabled?: boolean;
      } = await ctx.runQuery(api.staff.verifyStaffLogin, {
        identifier,
        password,
      });
      if (!check.ok) {
        throw new Error(
          check.disabled
            ? "Ce compte a été désactivé par l'administration."
            : "Identifiant ou mot de passe incorrect.",
        );
      }
      if (!check.userId) {
        throw new Error("Identifiant ou mot de passe incorrect.");
      }
      return { userId: check.userId };
    }

    // 2. Shared clinic password.
    const matches = await ctx.runQuery(api.settings.staffPasswordMatches, {
      password,
    });
    if (!matches) {
      throw new Error("Mot de passe de l'administration incorrect.");
    }

    // Find the shared staff account or provision it on first login. The
    // shared account keeps admin rights so the team can create named
    // accounts from the dashboard.
    const { user } = await createAccount(ctx, {
      provider: "staff",
      account: { id: STAFF_EMAIL },
      profile: {
        name: "Administration de la clinique",
        email: STAFF_EMAIL,
        role: "staff",
        staffRole: "admin",
      },
    });
    if (!user) {
      throw new Error("Impossible de créer le compte de l'administration.");
    }
    if (user.staffRole == null) {
      await ctx.runMutation(api.staff.ensureStaffAdminRole, {
        memberId: user._id,
      });
    }
    // The shared account used to be named « Personnel de la clinique »:
    // refresh the display name so existing deployments also show the new
    // label (idempotent).
    await ctx.runMutation(api.staff.refreshSharedStaffAccountName, {
      memberId: user._id,
    });
    return { userId: user._id };
  },
});
