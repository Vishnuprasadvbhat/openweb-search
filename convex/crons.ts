import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Check all active websites every 15 seconds (for testing)
// Note: In production, this should be set to a more reasonable interval like 5 minutes
crons.interval(
  "check active websites",
  { seconds: 15 },
  internal.monitoring.checkActiveWebsites
);

// ── RIPER crons ──────────────────────────────────────────────────────────────

// Process extraction queue every 30 seconds
crons.interval(
  "riper-extraction-queue",
  { seconds: 30 },
  internal.riper.queue.processBatch
);

// Daily retention sweep at 00:00 JST (15:00 UTC)
crons.daily(
  "riper-retention",
  { hourUTC: 15, minuteUTC: 0 },
  internal.riper.retention.sweep
);

export default crons;
