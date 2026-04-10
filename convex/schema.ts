import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,
  
  // API Keys
  apiKeys: defineTable({
    userId: v.id("users"),
    key: v.string(),
    name: v.string(),
    lastUsed: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_key", ["key"]),

  // Firecrawl Auth
  firecrawlApiKeys: defineTable({
    userId: v.id("users"),
    encryptedKey: v.string(),
    lastUsed: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // Website monitoring tables
  websites: defineTable({
    url: v.string(),
    name: v.string(),
    userId: v.id("users"),
    isActive: v.boolean(),
    isPaused: v.optional(v.boolean()), // For manual pause separate from isActive
    checkInterval: v.number(), // in minutes
    lastChecked: v.optional(v.number()),
    notificationPreference: v.optional(v.union(
      v.literal("none"),
      v.literal("email"),
      v.literal("webhook"),
      v.literal("both")
    )),
    webhookUrl: v.optional(v.string()),
    monitorType: v.optional(v.union(
      v.literal("single_page"),
      v.literal("full_site")
    )),
    crawlLimit: v.optional(v.number()), // max pages to crawl
    crawlDepth: v.optional(v.number()), // max depth to crawl
    lastCrawlAt: v.optional(v.number()),
    totalPages: v.optional(v.number()), // total pages found in last crawl
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_active", ["isActive"]),

  scrapeResults: defineTable({
    websiteId: v.id("websites"),
    userId: v.id("users"),
    markdown: v.string(),
    changeStatus: v.union(
      v.literal("new"),
      v.literal("same"),
      v.literal("changed"),
      v.literal("removed"),
      v.literal("checking")
    ),
    visibility: v.union(v.literal("visible"), v.literal("hidden")),
    previousScrapeAt: v.optional(v.number()),
    scrapedAt: v.number(),
    firecrawlMetadata: v.optional(v.any()),
    ogImage: v.optional(v.string()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    url: v.optional(v.string()), // The actual URL that was scraped
    diff: v.optional(v.object({
      text: v.string(),
      json: v.any(),
    })),
    // AI Analysis results
    aiAnalysis: v.optional(v.object({
      meaningfulChangeScore: v.number(), // 0-100
      isMeaningfulChange: v.boolean(),
      reasoning: v.string(),
      analyzedAt: v.number(),
      model: v.string(),
    })),
  })
    .index("by_website", ["websiteId"])
    .index("by_website_time", ["websiteId", "scrapedAt"])
    .index("by_user_time", ["userId", "scrapedAt"]),

  changeAlerts: defineTable({
    websiteId: v.id("websites"),
    userId: v.id("users"),
    scrapeResultId: v.id("scrapeResults"),
    changeType: v.string(),
    summary: v.string(),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_website", ["websiteId"])
    .index("by_read_status", ["userId", "isRead"]),

  emailConfig: defineTable({
    userId: v.id("users"),
    email: v.string(),
    isVerified: v.boolean(),
    verificationToken: v.optional(v.string()),
    verificationExpiry: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_email", ["email"])
    .index("by_token", ["verificationToken"]),
    
  // User settings for defaults
  userSettings: defineTable({
    userId: v.id("users"),
    defaultWebhookUrl: v.optional(v.string()),
    emailNotificationsEnabled: v.boolean(),
    emailTemplate: v.optional(v.string()),
    // AI Analysis settings
    aiAnalysisEnabled: v.optional(v.boolean()),
    aiModel: v.optional(v.string()), // Anthropic model ID (e.g. claude-haiku-4-5-20251001)
    aiBaseUrl: v.optional(v.string()), // DEPRECATED: kept for backward compat with existing docs — no longer read or written
    aiSystemPrompt: v.optional(v.string()),
    aiMeaningfulChangeThreshold: v.optional(v.number()), // 0-100 score threshold
    aiApiKey: v.optional(v.string()), // encrypted API key
    // AI-based notification filtering
    emailOnlyIfMeaningful: v.optional(v.boolean()), // only send email if AI deems meaningful
    webhookOnlyIfMeaningful: v.optional(v.boolean()), // only send webhook if AI deems meaningful
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"]),

  webhookPlayground: defineTable({
    payload: v.any(),
    headers: v.any(),
    method: v.string(),
    url: v.string(),
    receivedAt: v.number(),
    status: v.string(),
    response: v.optional(v.any()),
  })
    .index("by_time", ["receivedAt"]),

  // ── RIPER tables ──────────────────────────────────────────────────────────

  missions: defineTable({
    userId: v.id("users"),
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
    watchedWebsiteIds: v.array(v.id("websites")),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_active_user", ["userId", "isActive"]),

  intelligenceItems: defineTable({
    missionId: v.id("missions"),
    websiteId: v.optional(v.id("websites")),
    userId: v.id("users"),
    extractedFact: v.string(),
    factJson: v.any(),
    confidence: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    status: v.union(
      v.literal("active"),
      v.literal("superseded"),
      v.literal("excluded"),
    ),
    supersededBy: v.optional(v.id("intelligenceItems")),
    sourceUrl: v.string(),
    sourcePublishedAt: v.optional(v.number()),
    dedupHash: v.string(),
    sourceInfo: v.any(),
    extractedAt: v.number(),
  })
    .index("by_mission_status", ["missionId", "status"])
    .index("by_mission_time", ["missionId", "extractedAt"])
    .index("by_user_time", ["userId", "extractedAt"])
    .index("by_dedup", ["missionId", "dedupHash"])
    .index("by_published", ["sourcePublishedAt"]),

  reports: defineTable({
    missionId: v.id("missions"),
    userId: v.id("users"),
    markdownContent: v.string(),
    itemsIncluded: v.array(v.id("intelligenceItems")),
    synthesizedAt: v.number(),
    triggeredBy: v.union(
      v.literal("manual"),
      v.literal("search_orchestration"),
      v.literal("scheduled"),
    ),
  })
    .index("by_mission_time", ["missionId", "synthesizedAt"])
    .index("by_user_time", ["userId", "synthesizedAt"]),

  extractionQueue: defineTable({
    missionId: v.id("missions"),
    userId: v.id("users"),
    payload: v.object({
      sourceUrl: v.string(),
      sourceText: v.string(),
      websiteId: v.optional(v.id("websites")),
      sourcePublishedAt: v.optional(v.number()),
    }),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    attempts: v.number(),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_status_time", ["status", "createdAt"])
    .index("by_mission", ["missionId"]),

  // ── Existing Observer tables continued ──────────────────────────────────

  crawlSessions: defineTable({
    websiteId: v.id("websites"),
    userId: v.id("users"),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    pagesFound: v.number(),
    pagesChanged: v.optional(v.number()),
    pagesAdded: v.optional(v.number()),
    pagesRemoved: v.optional(v.number()),
    error: v.optional(v.string()),
    jobId: v.optional(v.string()), // Firecrawl async job ID
  })
    .index("by_website", ["websiteId"])
    .index("by_user_time", ["userId", "startedAt"]),
});

export default schema;