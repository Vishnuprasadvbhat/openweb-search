import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireCurrentUser, getCurrentUser } from "./helpers";

// Generate a random API key
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'fc_';
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// Get user's API keys
export const getUserApiKeys = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Don't return the full key for security, just the first and last few characters
    return apiKeys.map(key => ({
      _id: key._id,
      name: key.name,
      keyPreview: `${key.key.slice(0, 7)}...${key.key.slice(-4)}`,
      lastUsed: key.lastUsed,
      createdAt: key.createdAt,
    }));
  },
});

// Create a new API key
export const createApiKey = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    
    // Check if user already has 5 API keys
    const existingKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    
    if (existingKeys.length >= 5) {
      throw new Error("Maximum of 5 API keys allowed per user");
    }

    const apiKey = generateApiKey();
    
    const keyId = await ctx.db.insert("apiKeys", {
      userId: user._id,
      key: apiKey,
      name: args.name,
      createdAt: Date.now(),
    });

    // Return the full key only on creation
    return {
      _id: keyId,
      key: apiKey,
      name: args.name,
    };
  },
});

// Delete an API key
export const deleteApiKey = mutation({
  args: {
    keyId: v.id("apiKeys"),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    
    const apiKey = await ctx.db.get(args.keyId);
    if (!apiKey || apiKey.userId !== user._id) {
      throw new Error("API key not found");
    }

    await ctx.db.delete(args.keyId);
  },
});

// Internal function to validate API key and get user
export const validateApiKeyAndGetUser = internalMutation({
  args: { apiKey: v.string() },
  handler: async (ctx, args) => {
    const keyRecord = await ctx.db
      .query("apiKeys")
      .withIndex("by_key", (q) => q.eq("key", args.apiKey))
      .first();
    
    if (!keyRecord) {
      return null;
    }

    // Update last used timestamp
    await ctx.db.patch(keyRecord._id, {
      lastUsed: Date.now(),
    });

    return await ctx.db.get(keyRecord.userId);
  },
});