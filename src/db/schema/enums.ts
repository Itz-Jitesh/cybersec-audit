import { pgEnum } from "drizzle-orm/pg-core";

/** docs/04-DATA-MODEL.md §1. */

export const workspaceRole = pgEnum("workspace_role", [
  "admin",
  "president",
  "co_president",
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
]);
