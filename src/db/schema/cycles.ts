import { relations } from "drizzle-orm";
import {
  date,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { cycleStatus } from "@/db/schema/enums";
import { profiles } from "@/db/schema/profiles";
import { projects } from "@/db/schema/projects";

/**
 * status is maintained by a daily cron rather than computed on read, so a
 * cycle's state is stable for the whole day and can be filtered on in SQL.
 */
export const cycles = pgTable("cycles", {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
  startDate: date().notNull(),
  endDate: date().notNull(),
  status: cycleStatus().notNull().default("upcoming"),
  createdBy: uuid()
    .notNull()
    .references(() => profiles.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** One row per active cycle per day, written by cron. Drives the burndown chart. */
export const cycleSnapshots = pgTable(
  "cycle_snapshots",
  {
    id: uuid().primaryKey().defaultRandom(),
    cycleId: uuid()
      .notNull()
      .references(() => cycles.id, { onDelete: "cascade" }),
    snapshotDate: date().notNull(),
    totalIssues: integer().notNull().default(0),
    completedIssues: integer().notNull().default(0),
    startedIssues: integer().notNull().default(0),
    pendingIssues: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("cycle_snapshots_cycle_id_snapshot_date_key").on(
      table.cycleId,
      table.snapshotDate,
    ),
  ],
);

export const cyclesRelations = relations(cycles, ({ one, many }) => ({
  project: one(projects, {
    fields: [cycles.projectId],
    references: [projects.id],
  }),
  creator: one(profiles, {
    fields: [cycles.createdBy],
    references: [profiles.id],
  }),
  snapshots: many(cycleSnapshots),
}));

export const cycleSnapshotsRelations = relations(cycleSnapshots, ({ one }) => ({
  cycle: one(cycles, {
    fields: [cycleSnapshots.cycleId],
    references: [cycles.id],
  }),
}));
