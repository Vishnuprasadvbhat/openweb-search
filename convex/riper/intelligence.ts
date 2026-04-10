import { v } from "convex/values";
import { query, internalQuery, internalMutation } from "../_generated/server";
import { getCurrentUser } from "../helpers";
import { Id } from "../_generated/dataModel";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ── Public queries (auth-gated) ──────────────────────────────────────────────

/** Live feed of intelligence items for a mission. */
export const getRecent = query({
  args: {
    missionId: v.id("missions"),
    limit: v.optional(v.number()),
    confidence: v.optional(
      v.union(v.literal("high"), v.literal("medium"), v.literal("low"))
    ),
    status: v.optional(
      v.union(v.literal("active"), v.literal("superseded"), v.literal("excluded"))
    ),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    let q = ctx.db
      .query("intelligenceItems")
      .withIndex("by_mission_time", (idx) => idx.eq("missionId", args.missionId))
      .order("desc");

    const items = await q.take(args.limit || 50);

    // Apply in-memory filters (Convex doesn't support multi-field index filters easily)
    return items.filter((item) => {
      if (item.userId !== user._id) return false;
      if (args.confidence && item.confidence !== args.confidence) return false;
      if (args.status && item.status !== args.status) return false;
      return true;
    });
  },
});

/** All recent items across all missions for the current user. */
export const getRecentForUser = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("intelligenceItems")
      .withIndex("by_user_time", (idx) => idx.eq("userId", user._id))
      .order("desc")
      .take(args.limit || 50);
  },
});

/** Coverage gaps: topics from the mission's coverageMap that have zero active items in the last 30d. */
export const getCoverageGaps = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return { gaps: [], covered: [] };

    const mission = await ctx.db.get(args.missionId);
    if (!mission || mission.userId !== user._id) return { gaps: [], covered: [] };

    const cutoff = Date.now() - THIRTY_DAYS_MS;

    const recentItems = await ctx.db
      .query("intelligenceItems")
      .withIndex("by_mission_status", (idx) =>
        idx.eq("missionId", args.missionId).eq("status", "active")
      )
      .filter((q) => q.gt(q.field("extractedAt"), cutoff))
      .collect();

    // Build set of covered topics by checking if any item's fact mentions the topic
    const covered: string[] = [];
    const gaps: string[] = [];
    const allFacts = recentItems.map((i) => i.extractedFact.toLowerCase()).join(" ");

    for (const topic of mission.coverageMap.topics) {
      // Simple keyword check — a topic is covered if any recent fact mentions it
      const topicLower = topic.toLowerCase();
      if (allFacts.includes(topicLower)) {
        covered.push(topic);
      } else {
        gaps.push(topic);
      }
    }

    return { gaps, covered };
  },
});

/** Count of active items for a mission. */
export const getActiveCount = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return 0;

    const items = await ctx.db
      .query("intelligenceItems")
      .withIndex("by_mission_status", (idx) =>
        idx.eq("missionId", args.missionId).eq("status", "active")
      )
      .collect();

    return items.filter((i) => i.userId === user._id).length;
  },
});

// ── Internal queries/mutations (used by extraction, bridge, search) ──────────

export const getByDedupHash = internalQuery({
  args: {
    missionId: v.id("missions"),
    dedupHash: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("intelligenceItems")
      .withIndex("by_dedup", (idx) =>
        idx.eq("missionId", args.missionId).eq("dedupHash", args.dedupHash)
      )
      .first();
  },
});

export const insertItem = internalMutation({
  args: {
    missionId: v.id("missions"),
    websiteId: v.optional(v.id("websites")),
    userId: v.id("users"),
    extractedFact: v.string(),
    factJson: v.any(),
    confidence: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
    status: v.union(v.literal("active"), v.literal("superseded"), v.literal("excluded")),
    sourceUrl: v.string(),
    sourcePublishedAt: v.optional(v.number()),
    dedupHash: v.string(),
    sourceInfo: v.any(),
    extractedAt: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"intelligenceItems">> => {
    return await ctx.db.insert("intelligenceItems", args);
  },
});

export const markSuperseded = internalMutation({
  args: {
    itemId: v.id("intelligenceItems"),
    supersededBy: v.id("intelligenceItems"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.itemId, {
      status: "superseded",
      supersededBy: args.supersededBy,
    });
  },
});

/** Internal: count active items for a mission (used by search.ts for early-exit). */
export const countActiveInternal = internalQuery({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("intelligenceItems")
      .withIndex("by_mission_status", (idx) =>
        idx.eq("missionId", args.missionId).eq("status", "active")
      )
      .collect();
    return items.length;
  },
});

/** Internal: get active items for synthesis (last 30d). */
export const getActiveForSynthesis = internalQuery({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    return await ctx.db
      .query("intelligenceItems")
      .withIndex("by_mission_status", (idx) =>
        idx.eq("missionId", args.missionId).eq("status", "active")
      )
      .filter((q) => q.gt(q.field("extractedAt"), cutoff))
      .collect();
  },
});

/** Internal: coverage gaps (same logic as public, but takes userId instead of auth). */
export const getCoverageGapsInternal = internalQuery({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const mission = await ctx.db.get(args.missionId);
    if (!mission) return { gaps: [], covered: [] };

    const cutoff = Date.now() - THIRTY_DAYS_MS;

    const recentItems = await ctx.db
      .query("intelligenceItems")
      .withIndex("by_mission_status", (idx) =>
        idx.eq("missionId", args.missionId).eq("status", "active")
      )
      .filter((q) => q.gt(q.field("extractedAt"), cutoff))
      .collect();

    const covered: string[] = [];
    const gaps: string[] = [];
    const allFacts = recentItems.map((i) => i.extractedFact.toLowerCase()).join(" ");

    for (const topic of mission.coverageMap.topics) {
      const topicLower = topic.toLowerCase();
      if (allFacts.includes(topicLower)) {
        covered.push(topic);
      } else {
        gaps.push(topic);
      }
    }

    return { gaps, covered };
  },
});
