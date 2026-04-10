import { v } from "convex/values";
import { internalMutation, internalQuery, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

const MAX_BATCH = 10;
const MAX_ATTEMPTS = 3;

// ── Enqueue an extraction job (called by bridge.ts) ──────────────────────────
export const enqueue = internalMutation({
  args: {
    missionId: v.id("missions"),
    userId: v.id("users"),
    payload: v.object({
      sourceUrl: v.string(),
      sourceText: v.string(),
      websiteId: v.optional(v.id("websites")),
      sourcePublishedAt: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("extractionQueue", {
      missionId: args.missionId,
      userId: args.userId,
      payload: args.payload,
      status: "pending",
      attempts: 0,
      createdAt: Date.now(),
    });
  },
});

// ── Process pending queue items (called by cron every 30s) ───────────────────
export const processBatch = internalAction({
  handler: async (ctx) => {
    // Fetch pending items
    const pending = await ctx.runQuery(internal.riper.queue.getPendingItems, {
      limit: MAX_BATCH,
    });

    if (pending.length === 0) return;

    for (const item of pending) {
      // Mark as running
      await ctx.runMutation(internal.riper.queue.markRunning, {
        queueId: item._id,
      });

      try {
        // Dispatch extraction
        await ctx.runAction(internal.riper.extraction.extractFacts, {
          missionId: item.missionId,
          userId: item.userId,
          sourceUrl: item.payload.sourceUrl,
          sourceText: item.payload.sourceText,
          websiteId: item.payload.websiteId,
          sourcePublishedAt: item.payload.sourcePublishedAt,
        });

        // Mark completed
        await ctx.runMutation(internal.riper.queue.markCompleted, {
          queueId: item._id,
        });
      } catch (error) {
        const errorMsg = (error as Error).message || "Unknown error";
        const nextAttempts = item.attempts + 1;

        if (nextAttempts >= MAX_ATTEMPTS) {
          await ctx.runMutation(internal.riper.queue.markFailed, {
            queueId: item._id,
            error: errorMsg,
          });
        } else {
          // Back to pending with incremented attempts
          await ctx.runMutation(internal.riper.queue.markRetry, {
            queueId: item._id,
            attempts: nextAttempts,
            error: errorMsg,
          });
        }
      }
    }
  },
});

// ── Internal queries/mutations for queue state transitions ───────────────────

export const getPendingItems = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("extractionQueue")
      .withIndex("by_status_time", (q) => q.eq("status", "pending"))
      .order("asc")
      .take(args.limit);
  },
});

export const markRunning = internalMutation({
  args: { queueId: v.id("extractionQueue") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, { status: "running" });
  },
});

export const markCompleted = internalMutation({
  args: { queueId: v.id("extractionQueue") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, { status: "completed" });
  },
});

export const markFailed = internalMutation({
  args: {
    queueId: v.id("extractionQueue"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, {
      status: "failed",
      error: args.error,
    });
  },
});

export const markRetry = internalMutation({
  args: {
    queueId: v.id("extractionQueue"),
    attempts: v.number(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, {
      status: "pending",
      attempts: args.attempts,
      error: args.error,
    });
  },
});
