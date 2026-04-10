import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { callAnthropicWithBackoff, extractJson } from "../lib/anthropic";

const MAX_ITERATIONS = 3;
const INTER_ITERATION_DELAY_MS = 5000;

/**
 * On-demand search orchestration. Iterative, bounded.
 * Gap analysis → web search → extraction → repeat → synthesis.
 */
export const runSearch = internalAction({
  args: {
    missionId: v.id("missions"),
    userId: v.id("users"),
    iteration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const iteration = args.iteration ?? 0;

    // Load mission
    const mission = await ctx.runQuery(internal.riper.missions.getByIdInternal, {
      missionId: args.missionId,
    });
    if (!mission) {
      console.error(`Search: mission ${args.missionId} not found`);
      return;
    }

    // Count active items before this iteration (for early-exit check)
    const countBefore = await ctx.runQuery(
      internal.riper.intelligence.countActiveInternal,
      { missionId: args.missionId }
    );

    // Get coverage gaps
    const { gaps } = await ctx.runQuery(
      internal.riper.intelligence.getCoverageGapsInternal,
      { missionId: args.missionId }
    );

    // Terminal conditions: no gaps, or max iterations reached
    if (gaps.length === 0 || iteration >= MAX_ITERATIONS) {
      console.log(
        `Search: terminating at iteration ${iteration} (gaps=${gaps.length}, max=${MAX_ITERATIONS}). Scheduling synthesis.`
      );
      await ctx.scheduler.runAfter(0, internal.riper.synthesis.generateReport, {
        missionId: args.missionId,
        userId: args.userId,
        triggeredBy: "search_orchestration",
      });
      return;
    }

    console.log(
      `Search iteration ${iteration} for ${mission.name}: ${gaps.length} gaps — ${gaps.slice(0, 5).join(", ")}`
    );

    // Ask Anthropic to generate targeted search queries for the gaps
    const queryGenResponse = await callAnthropicWithBackoff(ctx, args.userId, {
      system: `You are a research query generator for the mission "${mission.name}".

Mission goal: ${mission.goal}
Keywords: ${mission.coverageMap.keywords.join(", ")}
Source types: ${mission.coverageMap.sourceTypes.join(", ")}

Generate web search queries to fill the given intelligence gaps. Queries should be specific, in the same language as the mission content, and optimized for finding actionable results.

Respond with a JSON array of objects:
[{ "query": "search query text", "targetGap": "which gap this addresses" }]

Generate 2-4 queries maximum. Respond ONLY with the JSON array.`,
      messages: [
        {
          role: "user",
          content: `Gaps to fill:\n${gaps.map((g: string, i: number) => `${i + 1}. ${g}`).join("\n")}`,
        },
      ],
      model: "claude-haiku-4-5-20251001",
      temperature: 0.4,
      maxTokens: 1024,
    });

    let queries: Array<{ query: string; targetGap: string }>;
    try {
      queries = extractJson(queryGenResponse);
    } catch {
      console.error("Search: failed to parse query generation response");
      // Still try synthesis with what we have
      await ctx.scheduler.runAfter(0, internal.riper.synthesis.generateReport, {
        missionId: args.missionId,
        userId: args.userId,
        triggeredBy: "search_orchestration",
      });
      return;
    }

    if (!Array.isArray(queries) || queries.length === 0) {
      await ctx.scheduler.runAfter(0, internal.riper.synthesis.generateReport, {
        missionId: args.missionId,
        userId: args.userId,
        triggeredBy: "search_orchestration",
      });
      return;
    }

    // Execute each search query using Anthropic web_search tool
    for (const sq of queries.slice(0, 4)) {
      try {
        const searchResponse = await callAnthropicWithBackoff(ctx, args.userId, {
          system: `You are a research assistant. Use the web_search tool to find information for the given query. After searching, summarize the key facts you found, including source URLs and any dates mentioned. Be thorough and precise.`,
          messages: [
            {
              role: "user",
              content: sq.query,
            },
          ],
          tools: [
            {
              name: "web_search",
              description: "Search the web for information",
              input_schema: {
                type: "object",
                properties: {
                  query: {
                    type: "string",
                    description: "The search query",
                  },
                },
                required: ["query"],
              },
            },
          ],
          model: "claude-sonnet-4-6",
          maxTokens: 4096,
        });

        // Extract any text content from the search response
        const searchText = searchResponse.content
          .filter((b) => b.type === "text")
          .map((b) => b.text || "")
          .join("\n");

        if (searchText.trim()) {
          // Enqueue extraction for the search results
          await ctx.runMutation(internal.riper.queue.enqueue, {
            missionId: args.missionId,
            userId: args.userId,
            payload: {
              sourceUrl: `web_search:${sq.query}`,
              sourceText: searchText,
            },
          });
        }
      } catch (error) {
        console.error(`Search: web_search failed for query "${sq.query}":`, error);
        // Continue with other queries
      }
    }

    // Check if this iteration produced new items (early exit)
    // Wait a bit for queue processing, then check
    const countAfter = await ctx.runQuery(
      internal.riper.intelligence.countActiveInternal,
      { missionId: args.missionId }
    );

    if (countAfter <= countBefore && iteration > 0) {
      console.log(
        `Search: no new items in iteration ${iteration}. Early exit → synthesis.`
      );
      await ctx.scheduler.runAfter(0, internal.riper.synthesis.generateReport, {
        missionId: args.missionId,
        userId: args.userId,
        triggeredBy: "search_orchestration",
      });
      return;
    }

    // Schedule next iteration with delay
    await ctx.scheduler.runAfter(
      INTER_ITERATION_DELAY_MS,
      internal.riper.search.runSearch,
      {
        missionId: args.missionId,
        userId: args.userId,
        iteration: iteration + 1,
      }
    );
  },
});
