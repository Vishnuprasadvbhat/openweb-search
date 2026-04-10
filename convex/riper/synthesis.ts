import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { callAnthropicWithBackoff, extractText } from "../lib/anthropic";

/**
 * Synthesize a markdown report from active intelligence items for a mission.
 */
export const generateReport = internalAction({
  args: {
    missionId: v.id("missions"),
    userId: v.id("users"),
    triggeredBy: v.union(
      v.literal("manual"),
      v.literal("search_orchestration"),
      v.literal("scheduled")
    ),
  },
  handler: async (ctx, args) => {
    // Load mission
    const mission = await ctx.runQuery(internal.riper.missions.getByIdInternal, {
      missionId: args.missionId,
    });
    if (!mission) {
      console.error(`Synthesis: mission ${args.missionId} not found`);
      return;
    }

    // Fetch active items from the last 30 days
    const items = await ctx.runQuery(
      internal.riper.intelligence.getActiveForSynthesis,
      { missionId: args.missionId }
    );

    if (items.length === 0) {
      // Still create a report noting no intelligence found
      await ctx.runMutation(internal.riper.synthesis.saveReport, {
        missionId: args.missionId,
        userId: args.userId,
        markdownContent: `# ${mission.name} — Intelligence Report\n\n_No active intelligence items found in the last 30 days._\n\n_Generated: ${new Date().toISOString()}_`,
        itemsIncluded: [],
        triggeredBy: args.triggeredBy,
      });
      return;
    }

    // Build the facts digest for the prompt
    const factsDigest = items
      .map((item: any, i: number) => {
        const dateStr = item.sourcePublishedAt
          ? new Date(item.sourcePublishedAt).toISOString().split("T")[0]
          : "date unknown";
        return `[${i + 1}] ${item.extractedFact}\n    Confidence: ${item.confidence} | Source: ${item.sourceUrl} | Published: ${dateStr}`;
      })
      .join("\n\n");

    const outputSchemaHint = mission.coverageMap.outputSchema
      ? `\nUse this output structure where applicable:\n${JSON.stringify(mission.coverageMap.outputSchema, null, 2)}`
      : "";

    const systemPrompt = `You are an intelligence synthesis engine for the mission "${mission.name}".

Mission role: ${mission.role}
Mission goal: ${mission.goal}
Decision rules: ${mission.coverageMap.decisionRules.join("; ")}
${outputSchemaHint}

Synthesize the provided intelligence facts into a comprehensive, actionable markdown report.

Requirements:
- Group findings by topic/category relevant to the mission
- Every claim must cite its source using [N] notation matching the fact numbers
- Highlight high-confidence items prominently
- Include a summary section at the top with key findings
- Include an "Action Items" section recommending next steps
- Include source URLs as clickable links
- Write in the same language as the mission content (Japanese if the mission is Japanese)
- End with a coverage assessment: which topics have good intelligence vs gaps`;

    const response = await callAnthropicWithBackoff(ctx, args.userId, {
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Intelligence facts (${items.length} items):\n\n${factsDigest}\n\nSynthesize these into a comprehensive report.`,
        },
      ],
      model: "claude-sonnet-4-6",
      temperature: 0.3,
      maxTokens: 8192,
    });

    const markdown = extractText(response);

    await ctx.runMutation(internal.riper.synthesis.saveReport, {
      missionId: args.missionId,
      userId: args.userId,
      markdownContent: markdown,
      itemsIncluded: items.map((i: any) => i._id),
      triggeredBy: args.triggeredBy,
    });

    console.log(
      `Synthesis complete for mission ${mission.name}: ${items.length} items → report saved`
    );
  },
});

/** Internal mutation to persist a report. */
export const saveReport = internalMutation({
  args: {
    missionId: v.id("missions"),
    userId: v.id("users"),
    markdownContent: v.string(),
    itemsIncluded: v.array(v.id("intelligenceItems")),
    triggeredBy: v.union(
      v.literal("manual"),
      v.literal("search_orchestration"),
      v.literal("scheduled")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("reports", {
      missionId: args.missionId,
      userId: args.userId,
      markdownContent: args.markdownContent,
      itemsIncluded: args.itemsIncluded,
      synthesizedAt: Date.now(),
      triggeredBy: args.triggeredBy,
    });
  },
});
