import { createAccount } from "@convex-dev/auth/server";
import { api } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./demo";

/**
 * Orchestrates the demo-data seeding:
 *
 *  1. Ensure services & doctors exist.
 *  2. Create the login of the demo patient "Aminata Koné"
 *     (demo@clinic-bookings.local / demo1234) so the medical file can also
 *     be seen from the patient side ("Mon dossier").
 *  3. Insert the demo patients, profiles, visits and appointments
 *     (idempotent, see `seedDemoPatients` in `demo.ts`).
 */
export const seedDemoData = action({
  args: {},
  // The return type is annotated on purpose: it breaks the circular type
  // reference between the action and the generated `api` object (which
  // includes the action itself).
  handler: async (
    ctx,
  ): Promise<{
    seeded: boolean;
    patients: number;
    visits?: number;
    appointments?: number;
  }> => {
    await ctx.runMutation(api.seed.ensureSeedData);

    let demoPatientUserId: Id<"users"> | null = null;
    try {
      const { user } = await createAccount(ctx, {
        provider: "password",
        account: { id: DEMO_EMAIL, secret: DEMO_PASSWORD },
        profile: { name: "Aminata Koné", email: DEMO_EMAIL, role: "patient" },
      });
      demoPatientUserId = user._id;
    } catch (error) {
      // The patients are still seeded (staff view only) if the account
      // cannot be created.
      console.error(
        "[seedDemoData] Compte de démonstration non créé :",
        error,
      );
    }

    const result = await ctx.runMutation(api.demo.seedDemoPatients, {
      demoPatientUserId,
    });

    // Fill the newest real patient's record with fictional visits so the
    // PDF download of the dossier can be tested (idempotent).
    await ctx.runMutation(api.demo.fillLatestPatientDemoVisits);

    return result;
  },
});
