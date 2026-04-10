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

export default crons;