import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation, action } from "../_generated/server";
import { internal } from "../_generated/api";
import { requireCurrentUser, getCurrentUser } from "../helpers";
import { requireCurrentUserForAction } from "../helpers";

const coverageMapValidator = v.object({
  topics: v.array(v.string()),
  keywords: v.array(v.string()),
  sourceTypes: v.array(v.string()),
  outputSchema: v.any(),
  decisionRules: v.array(v.string()),
});

// ── Public queries ───────────────────────────────────────────────────────────

/** List active missions for current user. */
export const list = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("missions")
      .withIndex("by_active_user", (idx) =>
        idx.eq("userId", user._id).eq("isActive", true)
      )
      .collect();
  },
});

/** List all missions (including archived) for current user. */
export const listAll = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("missions")
      .withIndex("by_user", (idx) => idx.eq("userId", user._id))
      .collect();
  },
});

/** Get a single mission by ID. */
export const getById = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const mission = await ctx.db.get(args.missionId);
    if (!mission || mission.userId !== user._id) return null;
    return mission;
  },
});

/** List reports for a mission. */
export const getReports = query({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("reports")
      .withIndex("by_mission_time", (idx) => idx.eq("missionId", args.missionId))
      .order("desc")
      .take(20);
  },
});

/** List all reports for current user. */
export const getReportsForUser = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("reports")
      .withIndex("by_user_time", (idx) => idx.eq("userId", user._id))
      .order("desc")
      .take(args.limit || 20);
  },
});

/** Get a single report. */
export const getReport = query({
  args: { reportId: v.id("reports") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const report = await ctx.db.get(args.reportId);
    if (!report || report.userId !== user._id) return null;
    return report;
  },
});

// ── Mutations ────────────────────────────────────────────────────────────────

/** Create a new mission. */
export const create = mutation({
  args: {
    name: v.string(),
    role: v.string(),
    goal: v.string(),
    coverageMap: coverageMapValidator,
    watchedWebsiteIds: v.optional(v.array(v.id("websites"))),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const now = Date.now();

    return await ctx.db.insert("missions", {
      userId: user._id,
      name: args.name,
      role: args.role,
      goal: args.goal,
      coverageMap: args.coverageMap,
      watchedWebsiteIds: args.watchedWebsiteIds || [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update mission fields. */
export const update = mutation({
  args: {
    missionId: v.id("missions"),
    name: v.optional(v.string()),
    role: v.optional(v.string()),
    goal: v.optional(v.string()),
    coverageMap: v.optional(coverageMapValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const mission = await ctx.db.get(args.missionId);
    if (!mission || mission.userId !== user._id) {
      throw new Error("Mission not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.role !== undefined) updates.role = args.role;
    if (args.goal !== undefined) updates.goal = args.goal;
    if (args.coverageMap !== undefined) updates.coverageMap = args.coverageMap;

    await ctx.db.patch(args.missionId, updates);
  },
});

/** Link/unlink Observer websites to a mission. */
export const linkWebsites = mutation({
  args: {
    missionId: v.id("missions"),
    websiteIds: v.array(v.id("websites")),
  },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const mission = await ctx.db.get(args.missionId);
    if (!mission || mission.userId !== user._id) {
      throw new Error("Mission not found");
    }

    await ctx.db.patch(args.missionId, {
      watchedWebsiteIds: args.websiteIds,
      updatedAt: Date.now(),
    });
  },
});

/** Archive a mission (soft delete). */
export const archive = mutation({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);
    const mission = await ctx.db.get(args.missionId);
    if (!mission || mission.userId !== user._id) {
      throw new Error("Mission not found");
    }

    await ctx.db.patch(args.missionId, {
      isActive: false,
      updatedAt: Date.now(),
    });
  },
});

/** Trigger on-demand search for a mission. */
export const triggerSearch = action({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const userId = await requireCurrentUserForAction(ctx);

    await ctx.scheduler.runAfter(0, internal.riper.search.runSearch, {
      missionId: args.missionId,
      userId,
      iteration: 0,
    });

    return { success: true };
  },
});

/** Trigger manual report synthesis. */
export const triggerSynthesis = action({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const userId = await requireCurrentUserForAction(ctx);

    await ctx.scheduler.runAfter(0, internal.riper.synthesis.generateReport, {
      missionId: args.missionId,
      userId,
      triggeredBy: "manual",
    });

    return { success: true };
  },
});

// ── Internal queries ─────────────────────────────────────────────────────────

/** Get mission by ID (no auth — used by extraction/bridge/search). */
export const getByIdInternal = internalQuery({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.missionId);
  },
});

/** Import a mission from a profile (no auth — called by import script). */
export const importProfile = internalMutation({
  args: {
    userEmail: v.string(),
    name: v.string(),
    role: v.string(),
    goal: v.string(),
    coverageMap: v.object({
      topics: v.array(v.string()),
      keywords: v.array(v.string()),
      sourceTypes: v.array(v.string()),
      outputSchema: v.any(),
      decisionRules: v.array(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    // Look up user by email
    const users = await ctx.db.query("users").collect();
    const user = users.find((u: any) => u.email === args.userEmail);
    if (!user) {
      throw new Error(`User not found for email: ${args.userEmail}`);
    }

    const now = Date.now();
    const missionId = await ctx.db.insert("missions", {
      userId: user._id,
      name: args.name,
      role: args.role,
      goal: args.goal,
      coverageMap: args.coverageMap,
      watchedWebsiteIds: [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return missionId;
  },
});

/** Find active missions that watch a specific website (used by bridge). */
export const getActiveMissionsForWebsite = internalQuery({
  args: {
    userId: v.id("users"),
    websiteId: v.id("websites"),
  },
  handler: async (ctx, args) => {
    const allActive = await ctx.db
      .query("missions")
      .withIndex("by_active_user", (idx) =>
        idx.eq("userId", args.userId).eq("isActive", true)
      )
      .collect();

    // Filter to missions that have this websiteId in their watchedWebsiteIds
    return allActive.filter((m) =>
      m.watchedWebsiteIds.includes(args.websiteId)
    );
  },
});
