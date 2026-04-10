import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Store a webhook payload
export const storeWebhookPayload = mutation({
  args: {
    payload: v.any(),
    headers: v.any(),
    method: v.string(),
    url: v.string(),
    status: v.string(),
    response: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhookPlayground", {
      payload: args.payload,
      headers: args.headers,
      method: args.method,
      url: args.url,
      receivedAt: Date.now(),
      status: args.status,
      response: args.response,
    });

    // Keep only last 100 webhook payloads
    const allPayloads = await ctx.db
      .query("webhookPlayground")
      .withIndex("by_time")
      .order("desc")
      .collect();

    if (allPayloads.length > 100) {
      const toDelete = allPayloads.slice(100);
      for (const payload of toDelete) {
        await ctx.db.delete(payload._id);
      }
    }
  },
});

// Get webhook payloads
export const getWebhookPayloads = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const payloads = await ctx.db
      .query("webhookPlayground")
      .withIndex("by_time")
      .order("desc")
      .take(args.limit || 50);

    return payloads;
  },
});

// Clear all webhook payloads
export const clearWebhookPayloads = mutation({
  handler: async (ctx) => {
    const allPayloads = await ctx.db
      .query("webhookPlayground")
      .collect();

    for (const payload of allPayloads) {
      await ctx.db.delete(payload._id);
    }

    return { deleted: allPayloads.length };
  },
});