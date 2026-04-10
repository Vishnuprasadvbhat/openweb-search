import { internalMutation } from "../_generated/server";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

/**
 * Daily sweep (called by cron at 00:00 JST / 15:00 UTC):
 *  1. Mark active items older than 90d as "excluded"
 *  2. Hard-delete "excluded" items older than 1 year
 */
export const sweep = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const ninetyDaysAgo = now - NINETY_DAYS_MS;
    const oneYearAgo = now - ONE_YEAR_MS;

    // ── Step 1: age-out active items past 90d ──────────────────────────────
    let agedOut = 0;
    const staleItems = await ctx.db
      .query("intelligenceItems")
      .withIndex("by_published")
      .filter((q) =>
        q.and(
          q.neq(q.field("sourcePublishedAt"), undefined),
          q.lt(q.field("sourcePublishedAt"), ninetyDaysAgo),
          q.eq(q.field("status"), "active")
        )
      )
      .take(BATCH_SIZE);

    for (const item of staleItems) {
      await ctx.db.patch(item._id, { status: "excluded" });
      agedOut++;
    }

    // ── Step 2: hard-delete excluded items past 1 year ─────────────────────
    let deleted = 0;
    const ancientItems = await ctx.db
      .query("intelligenceItems")
      .withIndex("by_published")
      .filter((q) =>
        q.and(
          q.neq(q.field("sourcePublishedAt"), undefined),
          q.lt(q.field("sourcePublishedAt"), oneYearAgo),
          q.eq(q.field("status"), "excluded")
        )
      )
      .take(BATCH_SIZE);

    for (const item of ancientItems) {
      await ctx.db.delete(item._id);
      deleted++;
    }

    if (agedOut > 0 || deleted > 0) {
      console.log(`RIPER retention sweep: aged-out=${agedOut}, deleted=${deleted}`);
    }
  },
});
