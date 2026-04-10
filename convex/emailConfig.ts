import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { requireCurrentUser, getCurrentUser } from "./helpers";

// Get current user's email config
export const getEmailConfig = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return null;
    }

    const emailConfig = await ctx.db
      .query("emailConfig")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    return emailConfig;
  },
});

// Save or update email configuration
export const saveEmailConfig = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    // Check if email config already exists
    const existingConfig = await ctx.db
      .query("emailConfig")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existingConfig) {
      // Update existing config
      await ctx.db.patch(existingConfig._id, {
        email: args.email,
        isVerified: false, // Reset verification when email changes
        verificationToken: crypto.randomUUID(),
        verificationExpiry: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        updatedAt: Date.now(),
      });
    } else {
      // Create new config
      await ctx.db.insert("emailConfig", {
        userId: user._id,
        email: args.email,
        isVerified: false,
        verificationToken: crypto.randomUUID(),
        verificationExpiry: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // TODO: Send verification email using Resend
    return { success: true, message: "Email saved. Please check your inbox for verification." };
  },
});

// Verify email with token
export const verifyEmail = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    const emailConfig = await ctx.db
      .query("emailConfig")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!emailConfig) {
      throw new Error("Email configuration not found");
    }

    if (emailConfig.verificationToken !== args.token) {
      throw new Error("Invalid verification token");
    }

    if (emailConfig.verificationExpiry && emailConfig.verificationExpiry < Date.now()) {
      throw new Error("Verification token has expired");
    }

    await ctx.db.patch(emailConfig._id, {
      isVerified: true,
      verificationToken: undefined,
      verificationExpiry: undefined,
      updatedAt: Date.now(),
    });

    return { success: true, message: "Email verified successfully" };
  },
});

// Internal query to get user's email config
export const getUserEmailConfig = internalQuery({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const emailConfig = await ctx.db
      .query("emailConfig")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    return emailConfig;
  },
});