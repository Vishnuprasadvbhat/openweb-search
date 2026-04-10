// Shared Anthropic API helper — used by both Observer (aiAnalysis) and RIPER.
// All LLM calls in the codebase go through this module.

import { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { decrypt, isEncrypted } from "./encryption";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

// Retry config
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

export interface AnthropicContentBlock {
  type: "text" | "tool_use" | "tool_result";
  text?: string;
  [key: string]: unknown;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface CallAnthropicParams {
  system?: string;
  messages: AnthropicMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: AnthropicTool[];
}

export interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Resolve and decrypt the user's Anthropic API key from userSettings.
 */
async function getAnthropicKey(
  ctx: ActionCtx,
  userId: Id<"users">
): Promise<string> {
  const settings = await ctx.runQuery(
    internal.userSettings.getUserSettingsInternal,
    { userId }
  );

  if (!settings?.aiApiKey) {
    throw new AnthropicError(
      "No Anthropic API key configured. Add your key in Settings > AI Analysis.",
      "missing_key"
    );
  }

  // getUserSettingsInternal already decrypts, but guard against future changes
  if (isEncrypted(settings.aiApiKey)) {
    return await decrypt(settings.aiApiKey);
  }
  return settings.aiApiKey;
}

/**
 * Call Anthropic Messages API. No retry — use callAnthropicWithBackoff for that.
 */
export async function callAnthropic(
  ctx: ActionCtx,
  userId: Id<"users">,
  params: CallAnthropicParams
): Promise<AnthropicResponse> {
  const apiKey = await getAnthropicKey(ctx, userId);

  const body: Record<string, unknown> = {
    model: params.model || DEFAULT_MODEL,
    max_tokens: params.maxTokens ?? 1024,
    messages: params.messages,
  };
  if (params.system) body.system = params.system;
  if (params.temperature !== undefined) body.temperature = params.temperature;
  if (params.tools) body.tools = params.tools;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new AnthropicError(
      `Anthropic API error ${response.status}: ${errorBody}`,
      "api_error",
      response.status
    );
  }

  return (await response.json()) as AnthropicResponse;
}

/**
 * Call Anthropic with exponential backoff retry on transient errors (429, 529, network).
 * Hard-fails immediately on other 4xx errors.
 */
export async function callAnthropicWithBackoff(
  ctx: ActionCtx,
  userId: Id<"users">,
  params: CallAnthropicParams
): Promise<AnthropicResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callAnthropic(ctx, userId, params);
    } catch (error) {
      lastError = error as Error;

      if (error instanceof AnthropicError) {
        // Only retry on rate-limit (429) or overload (529)
        if (error.status && error.status !== 429 && error.status !== 529) {
          throw error;
        }
      }

      // Don't sleep after the last attempt
      if (attempt < MAX_RETRIES - 1) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError || new AnthropicError("Max retries exceeded", "retry_exhausted");
}

/**
 * Extract the first text content block from an Anthropic response.
 */
export function extractText(response: AnthropicResponse): string {
  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text ?? "";
}

/**
 * Extract text and parse as JSON. Throws if the response isn't valid JSON.
 */
export function extractJson<T = unknown>(response: AnthropicResponse): T {
  const text = extractText(response);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AnthropicError(
      `Failed to parse Anthropic response as JSON: ${text.substring(0, 200)}`,
      "parse_error"
    );
  }
}

export class AnthropicError extends Error {
  code: string;
  status?: number;

  constructor(message: string, code: string, status?: number) {
    super(message);
    this.name = "AnthropicError";
    this.code = code;
    this.status = status;
  }
}
