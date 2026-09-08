import { relations, sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { projectRole, stateGroup } from "@/db/schema/enums";
import { profiles } from "@/db/schema/profiles";
import { teams } from "@/db/schema/teams";

export const projects = pgTable(
  "projects",
  {
    id: uuid().primaryKey().defaultRandom(),
    teamId: uuid()
      .notNull()
      .references(() => teams.id),
    name: text().notNull(),
    /** 2–5 uppercase characters, unique workspace-wide. Drives CTF-142. */
    identifier: text().notNull(),
    description: text(),
    iconEmoji: text(),
    coverColor: text(),
    leadId: uuid().references(() => profiles.id, { onDelete: "set null" }),
    sequenceCounter: integer().notNull().default(0),
    isArchived: boolean().notNull().default(false),
    createdBy: uuid()
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("projects_identifier_upper_key").on(
      sql`upper(${table.identifier})`,
    ),
  ],
);

export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: projectRole().notNull().default("member"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("project_members_project_id_user_id_key").on(
      table.projectId,
      table.userId,
    ),
    index("project_members_user_id_idx").on(table.userId),
  ],
);

/** Workflow columns. Seeded per project on creation from DEFAULT_STATES. */
export const states = pgTable("states", {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text().notNull(),
  group: stateGroup().notNull(),
  color: text().notNull(),
  /** Fractional so a state can be inserted between two others without a rewrite. */
  sequence: doublePrecision().notNull(),
  isDefault: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const labels = pgTable(
  "labels",
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text().notNull(),
    color: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("labels_project_id_name_key").on(
      table.projectId,
      sql`lower(${table.name})`,
    ),
  ],
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  team: one(teams, { fields: [projects.teamId], references: [teams.id] }),
  lead: one(profiles, {
    fields: [projects.leadId],
    references: [profiles.id],
  }),
  creator: one(profiles, {
    fields: [projects.createdBy],
    references: [profiles.id],
  }),
  members: many(projectMembers),
  states: many(states),
  labels: many(labels),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(profiles, {
    fields: [projectMembers.userId],
    references: [profiles.id],
  }),
}));

export const statesRelations = relations(states, ({ one }) => ({
  project: one(projects, {
    fields: [states.projectId],
    references: [projects.id],
  }),
}));

export const labelsRelations = relations(labels, ({ one }) => ({
  project: one(projects, {
    fields: [labels.projectId],
    references: [projects.id],
  }),
}));
