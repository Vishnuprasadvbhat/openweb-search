# RTIQ -- Real-Time Intelligence & Observer Platform

A unified web monitoring and research intelligence platform built with **Next.js 15**, **Convex**, and the **Anthropic API**. Combines passive website change detection (Observer) with active AI-driven research orchestration (RIPER) in a single application.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Observer -- Website Change Monitoring](#observer----website-change-monitoring)
- [RIPER -- Research Intelligence Pipeline](#riper----research-intelligence-pipeline)
  - [Core Concepts](#core-concepts)
  - [Data Flow](#data-flow)
  - [Missions](#missions)
  - [Intelligence Items](#intelligence-items)
  - [Reports](#reports)
  - [Observer Bridge](#observer--riper-bridge)
  - [On-Demand Search](#on-demand-search)
  - [Extraction Queue](#extraction-queue)
  - [Retention Policy](#retention-policy)
- [Anthropic Integration](#anthropic-integration)
- [Database Schema](#database-schema)
- [Cron Jobs](#cron-jobs)
- [Project Structure](#project-structure)
- [Scripts](#scripts)
- [Configuration](#configuration)
- [Environment Variables](#environment-variables)

---

## Overview

RTIQ serves two complementary functions:

1. **Observer** -- Monitors registered websites on a schedule using Firecrawl, detects content changes via diffing, and sends alerts (email, webhook). Optionally uses AI to score change significance.

2. **RIPER** (Research Intelligence Pipeline for Extraction & Reporting) -- Defines research "missions" with goals, keywords, and coverage maps. Runs AI-powered web searches, extracts structured intelligence facts, deduplicates findings, and synthesizes markdown reports. Observer diffs are passively fed into RIPER missions when websites are linked.

Both surfaces share a single Convex backend, a shared Anthropic API helper, and a unified authentication layer (ConvexAuth).

---

## Architecture

```
                         +-------------------+
                         |   Next.js 15 App  |
                         |  (App Router)     |
                         +--------+----------+
                                  |
                    +-------------+-------------+
                    |                           |
              /  (Observer)              /riper  (RIPER)
              Dashboard, Settings        Dashboard, Missions,
              API Docs, Webhooks         Intelligence, Reports
                    |                           |
                    +-------------+-------------+
                                  |
                         +--------v----------+
                         |   Convex Backend  |
                         |   (Serverless)    |
                         +--------+----------+
                                  |
               +------------------+------------------+
               |                  |                  |
        +------v------+   +------v------+   +-------v------+
        |  Firecrawl  |   |  Anthropic  |   |  Convex DB   |
        |  (scraping) |   |  Messages   |   |  (tables +   |
        |             |   |  API        |   |   indexes)   |
        +-----------  +   +-------------+   +--------------+
```

### Data Flow Summary

```
Observer Scrape → Diff Detected → Change Alert
                                       |
                               +-------v--------+
                               | RIPER Bridge   |  (fire-and-forget)
                               +-------+--------+
                                       |
                               +-------v--------+
                               | Extraction     |  (Haiku: extract facts)
                               | Queue          |
                               +-------+--------+
                                       |
                               +-------v--------+
                               | Intelligence   |  (dedup, confidence, supersession)
                               | Items DB       |
                               +-------+--------+
                                       |
                               +-------v--------+
                               | Synthesis      |  (Sonnet: markdown report)
                               +----------------+
```

---

## Tech Stack

| Layer        | Technology                                          |
|------------- |-----------------------------------------------------|
| Frontend     | Next.js 15 (App Router, Turbopack), React 19, Tailwind CSS |
| Backend      | Convex (serverless functions, real-time DB, crons)  |
| Auth         | ConvexAuth (email/password)                          |
| AI           | Anthropic Messages API (Haiku, Sonnet, Opus)        |
| Scraping     | Firecrawl (single-page and full-site crawl)          |
| UI           | Radix UI, Lucide icons, shadcn/ui components        |
| Language     | TypeScript (strict)                                  |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Convex account (free tier works for dev)
- An Anthropic API key (`sk-ant-...`)
- A Firecrawl API key (for Observer scraping)

### Installation

```bash
cd firecrawl-observer
npm install
```

### Environment Setup

Create `.env.local` in the project root (Convex auto-populates `CONVEX_DEPLOYMENT`):

```env
CONVEX_DEPLOYMENT=dev:your-deployment-name
```

Set secrets in the Convex dashboard:

- `ENCRYPTION_KEY` -- 32-byte hex key for encrypting user API keys at rest
- Any other secrets referenced by auth config

### Running in Development

```bash
npm run dev
```

This starts both the Next.js frontend (Turbopack) and the Convex dev backend in parallel.

| Service     | URL                        |
|------------ |----------------------------|
| Frontend    | http://localhost:3000       |
| Convex      | https://dashboard.convex.dev |

### First-Time Setup

1. Register an account via the login page
2. Go to **Settings** and add your Anthropic API key
3. Add your Firecrawl API key (for Observer)
4. Add a website to monitor, or navigate to **/riper** to create a mission

---

## Observer -- Website Change Monitoring

The original surface of the application. Monitors websites for content changes.

### Features

- Add websites with configurable check intervals
- Single-page or full-site crawl modes
- Automatic diff generation between scrape snapshots
- AI-powered change significance scoring (0-100)
- Email and webhook notifications (optionally filtered by AI score)
- Scrape history timeline with visual diffs
- REST API with JWT-authenticated endpoints
- Webhook playground for testing integrations

### Key Files

| Path | Purpose |
|------|---------|
| `convex/websites.ts` | Website CRUD, scrape storage, alerts |
| `convex/firecrawl.ts` | Firecrawl integration, scheduling, diff engine |
| `convex/monitoring.ts` | Cron-driven active website check loop |
| `convex/aiAnalysis.ts` | AI change significance analysis |
| `convex/emailConfig.ts` | Email notification configuration |
| `src/app/page.tsx` | Main Observer dashboard |
| `src/app/settings/page.tsx` | User settings (API keys, AI model, thresholds) |
| `src/app/api-docs/` | API documentation page |

---

## RIPER -- Research Intelligence Pipeline

Accessible at `/riper` in the application. The RIPER button in the header navigates to this section.

### Core Concepts

**Mission** -- A research objective with a defined role, goal, keywords, topics, source types, and decision rules. Missions can optionally link Observer websites to receive passive intelligence from detected changes.

**Intelligence Item** -- A single extracted fact with confidence level, source attribution, dedup hash, and lifecycle status (active / superseded / excluded).

**Report** -- A synthesized markdown document generated from active intelligence items, grouped by topic with citations and action items.

**Coverage Map** -- The structured definition within a mission that guides what to search for:
- `topics` -- Broad subject areas to cover
- `keywords` -- Specific search terms (often Japanese)
- `sourceTypes` -- Types of sources to prioritize
- `decisionRules` -- Quality/relevance rules for the AI
- `outputSchema` -- Optional structured output hint

### Data Flow

RIPER has two input paths:

#### 1. Passive (Observer Bridge)
When Observer detects a website change, `firecrawl.ts` fires a scheduler call to `riper/bridge.ts`. The bridge checks if any active missions watch that website. If so, it enqueues extraction jobs for each matching mission.

```
firecrawl.ts (change detected)
  → scheduler.runAfter(0, riper.bridge.handleChange)
    → finds missions with watchedWebsiteIds.includes(websiteId)
      → riper.queue.enqueue (one per mission)
```

#### 2. Active (On-Demand Search)
When a user clicks "Run Search" on a mission, the search orchestrator runs iteratively:

```
User → triggerSearch action
  → riper/search.ts:runSearch (iteration 0)
    → Get coverage gaps (topics with no active intelligence)
    → Generate search queries via Haiku
    → Execute web_search via Sonnet (with tool use)
    → Enqueue extraction for results
    → Check for new items (early-exit if zero)
    → Schedule next iteration (max 3, 5s delay)
    → Final: trigger synthesis
```

### Missions

Create missions at `/riper/missions`. Each mission defines:

| Field | Description |
|-------|-------------|
| Name | Display name (e.g., "共立電機") |
| Role | The AI's persona for this mission |
| Goal | Primary intelligence objective |
| Topics | Subject areas to track (one per line) |
| Keywords | Search terms, typically Japanese (one per line) |
| Source Types | Preferred information sources (one per line) |
| Decision Rules | Quality guidelines for the AI (one per line) |
| Linked Websites | Observer websites whose diffs feed this mission |

**Mission Detail** (`/riper/missions/[id]`) shows:
- Active item count, topic coverage, coverage gaps
- Linked Observer websites (editable)
- Full mission configuration (role, keywords, decision rules)
- Report history
- "Run Search" and "Synthesize Report" action buttons
- Archive option

### Intelligence Items

Browse at `/riper/intelligence`. Each item displays:
- Extracted fact text
- Confidence badge (high/medium/low with color coding)
- Status badge (active/superseded/excluded)
- Source URL (clickable)
- Published and extracted dates

**Filters:** Mission, Confidence level, Status

**Confidence Tiering** (computed during extraction):
- **High** -- Has a date, source URL, and named entity
- **Medium** -- Has at least two of the above signals
- **Low** -- Fewer than two signals

**Deduplication:** SHA-256 hash of `missionId + normalized fact text`. Duplicate hashes are skipped.

**Supersession:** When a new fact on the same topic is detected, the old fact gets `status: "superseded"` with a `supersededBy` pointer to the new item.

### Reports

Browse at `/riper/reports`, detail at `/riper/reports/[id]`.

Reports are markdown documents synthesized by Claude Sonnet from active intelligence items. Each report includes:
- Key findings summary
- Facts grouped by topic/category
- Source citations with `[N]` notation
- Action items and recommendations
- Coverage assessment (what's known vs. gaps)

Reports render in the browser using a built-in markdown-to-HTML converter with Tailwind prose styling.

**Trigger modes:**
- `manual` -- User clicks "Synthesize Report"
- `search_orchestration` -- Automatically generated after search completion
- `scheduled` -- (Reserved for future cron-based synthesis)

### Observer → RIPER Bridge

The bridge (`convex/riper/bridge.ts`) is the passive integration point:

1. `firecrawl.ts` detects a change and creates a `changeAlert`
2. Immediately after, it schedules `riper.bridge.handleChange`
3. The bridge loads the scrape result's diff text
4. Queries for active missions where `watchedWebsiteIds` includes the changed website
5. For each matching mission, enqueues an extraction job

This is fire-and-forget -- Observer is unaffected if RIPER processing fails.

### On-Demand Search

The search orchestrator (`convex/riper/search.ts`) implements bounded recursive search:

| Parameter | Value |
|-----------|-------|
| Max iterations | 3 |
| Delay between iterations | 5 seconds |
| Early exit | If zero new items in an iteration |
| Query generation model | Claude Haiku |
| Web search model | Claude Sonnet (with `web_search` tool) |
| Synthesis model | Claude Sonnet |

**Search flow per iteration:**
1. Check coverage gaps (topics with no active intelligence)
2. Ask Haiku to generate 2-4 targeted search queries
3. For each query, call Sonnet with the `web_search` tool
4. Enqueue extraction for any results
5. Compare active item count before/after (early-exit if unchanged)
6. Schedule next iteration or trigger synthesis

### Extraction Queue

`convex/riper/queue.ts` manages a durable extraction queue:

- **Cron:** Processes pending items every 30 seconds
- **Batch size:** 10 items per cycle
- **Max attempts:** 3 (with retry on failure)
- **States:** `pending` → `running` → `completed` | `failed`

Each queue item dispatches to `riper/extraction.ts:extractFacts`, which:
1. Loads the mission's coverage map
2. Calls Haiku to extract structured facts as JSON
3. Tiers confidence (high/medium/low)
4. Computes SHA-256 dedup hash
5. Checks for duplicates via the `by_dedup` index
6. Handles supersession of older facts
7. Inserts new intelligence items

### Retention Policy

Daily cron at 00:00 JST (`convex/riper/retention.ts`):

| Age | Action |
|-----|--------|
| > 90 days | `active` → `excluded` |
| > 1 year | Hard delete `excluded` items |

Processes in batches of 100 per run.

---

## Anthropic Integration

All AI calls go through the shared helper at `convex/lib/anthropic.ts`:

```typescript
callAnthropic(ctx, userId, options)        // Single call
callAnthropicWithBackoff(ctx, userId, options) // With retry on 429/529
extractText(response)                      // Pull text from response
extractJson(response)                      // Parse JSON from response
```

**API key resolution:** Per-user encrypted key stored in `userSettings.aiApiKey`. Decrypted at call time using the `ENCRYPTION_KEY` environment variable.

**Models used across the application:**

| Context | Model | Why |
|---------|-------|-----|
| Observer AI analysis | Haiku | Fast, cheap change scoring |
| RIPER fact extraction | Haiku | High-volume, structured extraction |
| RIPER query generation | Haiku | Simple query formulation |
| RIPER web search | Sonnet | Tool use (web_search) requires stronger model |
| RIPER report synthesis | Sonnet | Complex multi-source synthesis |
| Settings test | Haiku | Quick API key validation |

**Retry behavior:** Exponential backoff on HTTP 429 (rate limit) and 529 (overloaded), up to 3 retries starting at 1 second.

---

## Database Schema

### Observer Tables

| Table | Purpose |
|-------|---------|
| `users` | ConvexAuth managed user accounts |
| `apiKeys` | REST API keys for external integrations |
| `firecrawlApiKeys` | Encrypted Firecrawl API keys per user |
| `websites` | Monitored website configurations |
| `scrapeResults` | Scrape snapshots with diffs and AI analysis |
| `changeAlerts` | Detected change notifications |
| `emailConfig` | Email notification settings and verification |
| `userSettings` | User preferences, AI config, encrypted API keys |
| `webhookPlayground` | Webhook testing payloads |
| `crawlSessions` | Full-site crawl tracking |

### RIPER Tables

| Table | Purpose | Key Indexes |
|-------|---------|-------------|
| `missions` | Research mission definitions | `by_user`, `by_active_user` |
| `intelligenceItems` | Extracted intelligence facts | `by_mission_status`, `by_mission_time`, `by_user_time`, `by_dedup`, `by_published` |
| `reports` | Synthesized markdown reports | `by_mission_time`, `by_user_time` |
| `extractionQueue` | Durable extraction job queue | `by_status_time`, `by_mission` |

---

## Cron Jobs

| Name | Interval | Function | Purpose |
|------|----------|----------|---------|
| `check active websites` | 15 seconds | `monitoring.checkActiveWebsites` | Poll websites due for a scrape |
| `riper-extraction-queue` | 30 seconds | `riper.queue.processBatch` | Process pending extraction jobs |
| `riper-retention` | Daily 00:00 JST | `riper.retention.sweep` | Age-out and clean old intelligence |

---

## Project Structure

```
firecrawl-observer/
├── convex/                    # Convex backend
│   ├── _generated/            # Auto-generated types and API
│   ├── lib/
│   │   ├── anthropic.ts       # Shared Anthropic API helper
│   │   └── encryption.ts      # AES encryption for API keys
│   ├── riper/
│   │   ├── bridge.ts          # Observer → RIPER change bridge
│   │   ├── extraction.ts      # AI fact extraction
│   │   ├── intelligence.ts    # Intelligence item queries
│   │   ├── missions.ts        # Mission CRUD, triggers, internal queries
│   │   ├── queue.ts           # Durable extraction queue
│   │   ├── retention.ts       # Daily cleanup cron
│   │   ├── search.ts          # On-demand search orchestration
│   │   └── synthesis.ts       # Report generation
│   ├── schema.ts              # Full database schema
│   ├── crons.ts               # Cron job definitions
│   ├── firecrawl.ts           # Firecrawl scraping + bridge hook
│   ├── aiAnalysis.ts          # Observer AI change scoring
│   ├── monitoring.ts          # Website check scheduler
│   ├── websites.ts            # Website CRUD and scrape storage
│   ├── users.ts               # User queries
│   ├── helpers.ts             # Auth helper functions
│   └── ...
├── src/
│   ├── app/
│   │   ├── page.tsx           # Observer dashboard
│   │   ├── settings/          # User settings (AI, notifications)
│   │   ├── api-docs/          # API documentation
│   │   ├── riper/
│   │   │   ├── layout.tsx     # RIPER shell with sub-navigation
│   │   │   ├── page.tsx       # RIPER dashboard
│   │   │   ├── missions/
│   │   │   │   ├── page.tsx   # Mission list + create form
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx # Mission detail + actions
│   │   │   ├── intelligence/
│   │   │   │   └── page.tsx   # Intelligence feed with filters
│   │   │   └── reports/
│   │   │       ├── page.tsx   # Report list
│   │   │       └── [id]/
│   │   │           └── page.tsx # Report detail (rendered markdown)
│   │   └── ...
│   ├── components/
│   │   ├── layout/
│   │   │   ├── header.tsx     # Global header with RIPER + API buttons
│   │   │   └── layout.tsx     # Page shell
│   │   └── ui/                # shadcn/ui components
│   └── lib/                   # Utilities
├── profiles/                  # Japanese company research profiles (.md)
│   ├── 共立電機.md
│   └── 共立電照.md
├── scripts/
│   ├── import-riper-profiles.mjs  # Import profiles as missions
│   ├── generate-jwt-key.mjs       # Generate JWT signing key
│   └── set-convex-env.mjs         # Set Convex environment variables
└── riper/                     # Legacy Express proxy (deprecated)
    └── server.js              # Original standalone RIPER server
```

---

## Scripts

### Import RIPER Profiles

Import the pre-defined Japanese company research profiles as missions:

```bash
node scripts/import-riper-profiles.mjs <your-email>
```

This creates two missions (共立電機 and 共立電照) with their full coverage maps, keywords, and decision rules extracted from the profile `.md` files.

### Other Scripts

```bash
node scripts/generate-jwt-key.mjs     # Generate a JWT key for API auth
node scripts/set-convex-env.mjs       # Set environment variables in Convex
```

---

## Configuration

### AI Settings (per user)

Configured in **Settings** (`/settings`):

| Setting | Default | Description |
|---------|---------|-------------|
| AI Model | `claude-haiku-4-5-20251001` | Model for Observer change analysis |
| API Key | -- | User's Anthropic API key (encrypted at rest) |
| System Prompt | (built-in) | Custom prompt for change analysis |
| Meaningful Change Threshold | 50 | Score (0-100) above which a change is "meaningful" |
| Email Only If Meaningful | false | Filter email alerts by AI score |
| Webhook Only If Meaningful | false | Filter webhook alerts by AI score |

### RIPER Model Allocation

| Task | Model | Rationale |
|------|-------|-----------|
| Fact extraction | `claude-haiku-4-5-20251001` | High volume, structured output |
| Query generation | `claude-haiku-4-5-20251001` | Simple task, fast turnaround |
| Web search | `claude-sonnet-4-6` | Tool use requires capable model |
| Report synthesis | `claude-sonnet-4-6` | Complex multi-source reasoning |

---

## Environment Variables

### Convex Dashboard Secrets

| Variable | Required | Description |
|----------|----------|-------------|
| `ENCRYPTION_KEY` | Yes | 32-byte hex key for AES encryption of user API keys |
| `RESEND_API_KEY` | For email | Resend API key for sending notification emails |
| `AUTH_SECRET` | Yes | ConvexAuth session secret |

### Local (.env.local)

| Variable | Description |
|----------|-------------|
| `CONVEX_DEPLOYMENT` | Auto-set by `npx convex dev` |

### User-Level (stored encrypted in Convex)

| Setting | Where Set | Description |
|---------|-----------|-------------|
| Anthropic API Key | Settings page | Per-user `sk-ant-...` key |
| Firecrawl API Key | Settings page | Per-user Firecrawl key |

---

## Legacy RIPER Server

The `riper/` directory contains the original standalone Express proxy server that proxied Anthropic and Firecrawl API calls from a static HTML frontend. This has been superseded by the integrated Convex backend. The `riper/server.js` is no longer needed for normal operation but is retained for reference.

The `profiles/` directory contains the original Japanese research profiles in markdown format. These can be imported into the new missions system using the import script.
