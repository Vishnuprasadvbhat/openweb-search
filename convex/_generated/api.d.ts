/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiAnalysis from "../aiAnalysis.js";
import type * as alertEmail from "../alertEmail.js";
import type * as apiKeys from "../apiKeys.js";
import type * as auth from "../auth.js";
import type * as crawl from "../crawl.js";
import type * as crons from "../crons.js";
import type * as emailConfig from "../emailConfig.js";
import type * as emailManager from "../emailManager.js";
import type * as firecrawl from "../firecrawl.js";
import type * as firecrawlKeys from "../firecrawlKeys.js";
import type * as helpers from "../helpers.js";
import type * as http from "../http.js";
import type * as lib_anthropic from "../lib/anthropic.js";
import type * as lib_encryption from "../lib/encryption.js";
import type * as lib_sanitize from "../lib/sanitize.js";
import type * as monitoring from "../monitoring.js";
import type * as notifications from "../notifications.js";
import type * as riper_bridge from "../riper/bridge.js";
import type * as riper_extraction from "../riper/extraction.js";
import type * as riper_intelligence from "../riper/intelligence.js";
import type * as riper_missions from "../riper/missions.js";
import type * as riper_queue from "../riper/queue.js";
import type * as riper_retention from "../riper/retention.js";
import type * as riper_search from "../riper/search.js";
import type * as riper_synthesis from "../riper/synthesis.js";
import type * as testActions from "../testActions.js";
import type * as userSettings from "../userSettings.js";
import type * as users from "../users.js";
import type * as webhookPlayground from "../webhookPlayground.js";
import type * as websites from "../websites.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  aiAnalysis: typeof aiAnalysis;
  alertEmail: typeof alertEmail;
  apiKeys: typeof apiKeys;
  auth: typeof auth;
  crawl: typeof crawl;
  crons: typeof crons;
  emailConfig: typeof emailConfig;
  emailManager: typeof emailManager;
  firecrawl: typeof firecrawl;
  firecrawlKeys: typeof firecrawlKeys;
  helpers: typeof helpers;
  http: typeof http;
  "lib/anthropic": typeof lib_anthropic;
  "lib/encryption": typeof lib_encryption;
  "lib/sanitize": typeof lib_sanitize;
  monitoring: typeof monitoring;
  notifications: typeof notifications;
  "riper/bridge": typeof riper_bridge;
  "riper/extraction": typeof riper_extraction;
  "riper/intelligence": typeof riper_intelligence;
  "riper/missions": typeof riper_missions;
  "riper/queue": typeof riper_queue;
  "riper/retention": typeof riper_retention;
  "riper/search": typeof riper_search;
  "riper/synthesis": typeof riper_synthesis;
  testActions: typeof testActions;
  userSettings: typeof userSettings;
  users: typeof users;
  webhookPlayground: typeof webhookPlayground;
  websites: typeof websites;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {
  resend: {
    lib: {
      cancelEmail: FunctionReference<
        "mutation",
        "internal",
        { emailId: string },
        null
      >;
      get: FunctionReference<"query", "internal", { emailId: string }, any>;
      getStatus: FunctionReference<
        "query",
        "internal",
        { emailId: string },
        {
          complained: boolean;
          errorMessage: string | null;
          opened: boolean;
          status:
            | "waiting"
            | "queued"
            | "cancelled"
            | "sent"
            | "delivered"
            | "delivery_delayed"
            | "bounced";
        }
      >;
      handleEmailEvent: FunctionReference<
        "mutation",
        "internal",
        { event: any },
        null
      >;
      sendEmail: FunctionReference<
        "mutation",
        "internal",
        {
          from: string;
          headers?: Array<{ name: string; value: string }>;
          html?: string;
          options: {
            apiKey: string;
            initialBackoffMs: number;
            onEmailEvent?: { fnHandle: string };
            retryAttempts: number;
            testMode: boolean;
          };
          replyTo?: Array<string>;
          subject: string;
          text?: string;
          to: string;
        },
        string
      >;
    };
  };
};
