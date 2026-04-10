import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Bridge: Observer → RIPER
 * Called fire-and-forget from firecrawl.ts after a changeAlert is created.
 * Filters to missions that watch this website, then enqueues extraction for each.
 */
export const handleChange = internalAction({
  args: {
    scrapeResultId: v.id("scrapeResults"),
    websiteId: v.id("websites"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Load the scrape result to get diff text
    const scrapeResult = await ctx.runQuery(internal.websites.getScrapeResult, {
      scrapeResultId: args.scrapeResultId,
    });

    if (!scrapeResult?.diff?.text) {
      // No diff content to extract from
      return;
    }

    // Find active missions for this user that watch this website
    const missions = await ctx.runQuery(
      internal.riper.missions.getActiveMissionsForWebsite,
      { userId: args.userId, websiteId: args.websiteId }
    );

    if (missions.length === 0) {
      // No missions watching this website — skip extraction
      return;
    }

    // Enqueue extraction for each matching mission
    for (const mission of missions) {
      await ctx.runMutation(internal.riper.queue.enqueue, {
        missionId: mission._id,
        userId: args.userId,
        payload: {
          sourceUrl: scrapeResult.url || "",
          sourceText: scrapeResult.diff.text,
          websiteId: args.websiteId,
        },
      });
    }

    console.log(
      `RIPER bridge: enqueued extraction for ${missions.length} mission(s) from website ${args.websiteId}`
    );
  },
});
