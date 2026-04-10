import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { callAnthropicWithBackoff, extractText, AnthropicError } from "../lib/anthropic";

/**
 * Extract intelligence facts from source text using Anthropic.
 * Called by queue.processBatch (passive) and search.ts (active).
 *
 * Pipeline: LLM extract → tier confidence → compute dedup hash → dedup check → insert/supersede
 */
export const extractFacts = internalAction({
  args: {
    missionId: v.id("missions"),
    userId: v.id("users"),
    sourceUrl: v.string(),
    sourceText: v.string(),
    websiteId: v.optional(v.id("websites")),
    sourcePublishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Load the mission for its coverageMap
    const mission = await ctx.runQuery(internal.riper.missions.getByIdInternal, {
      missionId: args.missionId,
    });
    if (!mission) {
      console.error(`Extraction: mission ${args.missionId} not found`);
      return;
    }

    // Truncate very long source text to avoid blowing the context window
    const maxSourceLen = 12000;
    const sourceText =
      args.sourceText.length > maxSourceLen
        ? args.sourceText.substring(0, maxSourceLen) + "\n...[truncated]"
        : args.sourceText;

    const systemPrompt = `You are an intelligence extraction engine for the mission "${mission.name}".

Mission role: ${mission.role}
Mission goal: ${mission.goal}
Topics to cover: ${mission.coverageMap.topics.join(", ")}
Keywords: ${mission.coverageMap.keywords.join(", ")}
Decision rules: ${mission.coverageMap.decisionRules.join("; ")}

Extract concrete, actionable intelligence facts from the provided source text. Each fact must be:
- A specific, verifiable claim (not vague or speculative)
- Relevant to the mission's topics and goal
- Accompanied by confidence signals

Respond with a JSON array of fact objects. If no relevant facts exist, return an empty array [].

Each object:
{
  "fact": "short canonical statement of the fact",
  "factJson": { ... structured data matching mission output schema ... },
  "sourcePublishedAt": "ISO date string if found in text, or null",
  "confidenceSignals": ["has_date", "has_source_url", "has_named_entity", ...]
}

IMPORTANT: Respond ONLY with the JSON array, no other text.`;

    try {
      const response = await callAnthropicWithBackoff(ctx, args.userId, {
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: `Source URL: ${args.sourceUrl}\n\nSource text:\n${sourceText}`,
          },
        ],
        model: "claude-haiku-4-5-20251001",
        temperature: 0.2,
        maxTokens: 4096,
      });

      const text = extractText(response);
      let facts: Array<{
        fact: string;
        factJson: Record<string, unknown>;
        sourcePublishedAt: string | null;
        confidenceSignals: string[];
      }>;

      try {
        facts = JSON.parse(text);
      } catch {
        console.error("Extraction: failed to parse LLM response as JSON");
        return;
      }

      if (!Array.isArray(facts) || facts.length === 0) return;

      // Process each extracted fact
      for (const raw of facts) {
        if (!raw.fact || typeof raw.fact !== "string") continue;

        // ── Tier confidence ──────────────────────────────────────────
        const signals = raw.confidenceSignals || [];
        const hasDate = signals.includes("has_date") || !!raw.sourcePublishedAt;
        const hasSource = true; // always true — we have the sourceUrl
        const hasEntity = signals.includes("has_named_entity");

        const score = [hasDate, hasSource, hasEntity].filter(Boolean).length;
        const confidence: "high" | "medium" | "low" =
          score >= 3 ? "high" : score === 2 ? "medium" : "low";

        // Low-confidence → store as excluded (for dedup), but hidden from UI
        const status: "active" | "excluded" =
          confidence === "low" ? "excluded" : "active";

        // ── Parse published date ─────────────────────────────────────
        let sourcePublishedAt = args.sourcePublishedAt;
        if (!sourcePublishedAt && raw.sourcePublishedAt) {
          const parsed = Date.parse(raw.sourcePublishedAt);
          if (!isNaN(parsed)) sourcePublishedAt = parsed;
        }

        // ── Compute dedup hash ───────────────────────────────────────
        const normalized = raw.fact.trim().toLowerCase().replace(/\s+/g, " ");
        const hashInput = normalized + "|" + args.sourceUrl;
        const hashBuffer = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(hashInput)
        );
        const dedupHash = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // ── Dedup check + supersession ───────────────────────────────
        const existing = await ctx.runQuery(
          internal.riper.intelligence.getByDedupHash,
          { missionId: args.missionId, dedupHash }
        );

        if (existing) {
          // If the new fact has a newer published date, supersede the old one
          if (
            sourcePublishedAt &&
            (!existing.sourcePublishedAt ||
              sourcePublishedAt > existing.sourcePublishedAt)
          ) {
            const newId = await ctx.runMutation(
              internal.riper.intelligence.insertItem,
              {
                missionId: args.missionId,
                websiteId: args.websiteId,
                userId: args.userId,
                extractedFact: raw.fact,
                factJson: raw.factJson || {},
                confidence,
                status,
                sourceUrl: args.sourceUrl,
                sourcePublishedAt,
                dedupHash,
                sourceInfo: { signals, model: response.model },
                extractedAt: Date.now(),
              }
            );
            await ctx.runMutation(
              internal.riper.intelligence.markSuperseded,
              { itemId: existing._id, supersededBy: newId }
            );
          }
          // Otherwise skip — exact duplicate
          continue;
        }

        // ── Insert new item ──────────────────────────────────────────
        await ctx.runMutation(internal.riper.intelligence.insertItem, {
          missionId: args.missionId,
          websiteId: args.websiteId,
          userId: args.userId,
          extractedFact: raw.fact,
          factJson: raw.factJson || {},
          confidence,
          status,
          sourceUrl: args.sourceUrl,
          sourcePublishedAt,
          dedupHash,
          sourceInfo: { signals, model: response.model },
          extractedAt: Date.now(),
        });
      }
    } catch (error) {
      if (error instanceof AnthropicError) {
        console.error(`Extraction Anthropic error [${error.code}]: ${error.message}`);
      } else {
        console.error("Extraction error:", error);
      }
      throw error; // Re-throw so queue marks this as failed
    }
  },
});
