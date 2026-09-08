import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { teamRole, workspaceRole } from "@/db/schema/enums";
import { profiles } from "@/db/schema/profiles";
import { teams } from "@/db/schema/teams";

/**
 * Invite emails are compared case-insensitively against whatever casing the
 * OAuth provider hands back, so the column is citext rather than text. The
 * extension is enabled in supabase/migrations/0001_extensions.sql.
 */
const citext = customType<{ data: string }>({
  dataType: () => "citext",
});

/** There is exactly one workspace, so this table is the club roster. */
export const workspaceMembers = pgTable("workspace_members", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .unique()
    .references(() => profiles.id, { onDelete: "cascade" }),
  role: workspaceRole().notNull().default("member"),
  isActive: boolean().notNull().default(true),
  joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const invites = pgTable(
  "invites",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: citext().notNull(),
    role: workspaceRole().notNull().default("member"),
    teamId: uuid().references(() => teams.id, { onDelete: "set null" }),
    teamRole: teamRole(),
    token: uuid().notNull().unique().defaultRandom(),
    /**
     * Null means the invite was created by the seed script during bootstrap.
     * The very first administrator has to be invited before any profile exists,
     * so this cannot be not-null without making the workspace unbootstrappable.
     * Every invite created from the admin panel carries a real inviter.
     */
    invitedBy: uuid().references(() => profiles.id),
    expiresAt: timestamp({ withTimezone: true })
      .notNull()
      .default(sql`now() + interval '7 days'`),
    acceptedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One open invite per email. Accepted invites stay as history.
    uniqueIndex("invites_email_open_key")
      .on(table.email)
      .where(sql`accepted_at is null`),
  ],
);

/** Append-only. Written for invites, role changes, deactivations and deletions. */
export const auditLog = pgTable("audit_log", {
  id: uuid().primaryKey().defaultRandom(),
  actorId: uuid()
    .notNull()
    .references(() => profiles.id),
  action: text().notNull(),
  entityType: text().notNull(),
  entityId: uuid(),
  metadata: jsonb(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembersRelations = relations(
  workspaceMembers,
  ({ one }) => ({
    user: one(profiles, {
      fields: [workspaceMembers.userId],
      references: [profiles.id],
    }),
  }),
);

export const invitesRelations = relations(invites, ({ one }) => ({
  team: one(teams, { fields: [invites.teamId], references: [teams.id] }),
  inviter: one(profiles, {
    fields: [invites.invitedBy],
    references: [profiles.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(profiles, {
    fields: [auditLog.actorId],
    references: [profiles.id],
  }),
}));
