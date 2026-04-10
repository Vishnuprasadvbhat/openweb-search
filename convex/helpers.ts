import { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";

export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // The subject contains "userId|sessionId", we need to extract the userId
  const [userId] = identity.subject.split("|");
  
  const user = await ctx.db.get(userId as Id<"users">);
  return user;
}

export async function requireCurrentUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function getCurrentUserForAction(
  ctx: ActionCtx
): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // The subject contains "userId|sessionId", we need to extract the userId
  const [userId] = identity.subject.split("|");
  return userId as Id<"users">;
}

export async function requireCurrentUserForAction(
  ctx: ActionCtx
): Promise<Id<"users">> {
  const userId = await getCurrentUserForAction(ctx);
  if (!userId) {
    throw new Error("Unauthorized");
  }
  return userId;
}