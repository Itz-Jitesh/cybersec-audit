import { pgEnum } from "drizzle-orm/pg-core";

/** docs/04-DATA-MODEL.md §1. */

export const workspaceRole = pgEnum("workspace_role", [
  "admin",
  "president",
  "co_president",
  "mentor",
  "member",
]);

export const teamRole = pgEnum("team_role", ["lead", "member"]);

export const projectRole = pgEnum("project_role", ["admin", "member"]);

export const stateGroup = pgEnum("state_group", [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
]);

export const priority = pgEnum("priority", [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);

export const cycleStatus = pgEnum("cycle_status", [
  "upcoming",
  "active",
  "completed",
]);

export const moduleStatus = pgEnum("module_status", [
  "planned",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
]);

export const relationType = pgEnum("relation_type", [
  "blocks",
  "blocked_by",
  "relates_to",
  "duplicate_of",
]);

export const viewAccess = pgEnum("view_access", ["private", "public"]);

export const notificationType = pgEnum("notification_type", [
  "mention",
  "assigned",
  "state_changed",
  "commented",
  "subscribed",
  /** Someone started following an issue you lead, handle or follow. */
  "subscribed_to",
  /** A member asked for an issue to be created, or for one to be completed. */
  "appeal_submitted",
  "appeal_approved",
  "appeal_rejected",
]);

/**
 * What an appeal is asking for: a new issue, or the completion of one.
 *
 * Both travel through the same table because they share every other column and
 * the same decision flow — a lead sees one queue, not two.
 */
export const appealKind = pgEnum("appeal_kind", ["create", "complete"]);

export const appealStatus = pgEnum("appeal_status", [
  "pending",
  "approved",
  "rejected",
  /** Withdrawn by the person who raised it. */
  "cancelled",
]);
