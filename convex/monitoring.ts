import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

export const checkActiveWebsites = internalAction({
  handler: async (ctx) => {
    // Get all active websites that need checking
    const websites = await ctx.runQuery(internal.monitoring.getWebsitesToCheck);

    // Only log if there are websites to check
    if (websites.length > 0) {
      console.log(`Checking ${websites.length} websites`);
    }

    // Schedule scrapes for each website
    for (const website of websites) {
      try {
        // Remove verbose per-website logging
        
        if (website.monitorType === "full_site") {
          // For full site monitors, perform a crawl
          await ctx.scheduler.runAfter(0, internal.crawl.performCrawl, {
            websiteId: website._id,
            userId: website.userId,
          });
        } else {
          // For single page monitors, just check the URL
          await ctx.scheduler.runAfter(0, internal.firecrawl.scrapeUrl, {
            websiteId: website._id,
            url: website.url,
            userId: website.userId,
          });
        }
      } catch (error) {
        console.error(`Failed to schedule check for ${website.url}:`, error);
      }
    }
  },
});

// Internal query to get websites that need checking
export const getWebsitesToCheck = internalQuery({
  handler: async (ctx) => {
    const now = Date.now();

    // Get all active websites
    const activeWebsites = await ctx.db
      .query("websites")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Filter websites that need checking based on their interval
    const websitesToCheck = activeWebsites.filter((website) => {
      // Skip paused websites
      if (website.isPaused) {
        return false;
      }
      
      if (!website.lastChecked) {
        // Never checked before
        return true;
      }

      const timeSinceLastCheck = now - website.lastChecked;
      const intervalInMs = website.checkInterval * 60 * 1000;

      return timeSinceLastCheck >= intervalInMs;
    });

    return websitesToCheck;
  },
});

