import { relations } from "drizzle-orm";
import {
  date,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { moduleStatus } from "@/db/schema/enums";
import { issues } from "@/db/schema/issues";
import { profiles } from "@/db/schema/profiles";
import { projects } from "@/db/schema/projects";

export const modules = pgTable("modules", {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
  leadId: uuid().references(() => profiles.id, { onDelete: "set null" }),
  status: moduleStatus().notNull().default("planned"),
  startDate: date(),
  targetDate: date(),
  sortOrder: doublePrecision().notNull(),
  createdBy: uuid()
    .notNull()
    .references(() => profiles.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const moduleIssues = pgTable(
  "module_issues",
  {
    id: uuid().primaryKey().defaultRandom(),
    moduleId: uuid()
      .notNull()
      .references(() => modules.id, { onDelete: "cascade" }),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("module_issues_module_id_issue_id_key").on(
      table.moduleId,
      table.issueId,
    ),
    index("module_issues_issue_id_idx").on(table.issueId),
  ],
);

export const modulesRelations = relations(modules, ({ one, many }) => ({
  project: one(projects, {
    fields: [modules.projectId],
    references: [projects.id],
  }),
  lead: one(profiles, {
    fields: [modules.leadId],
    references: [profiles.id],
  }),
  creator: one(profiles, {
    fields: [modules.createdBy],
    references: [profiles.id],
  }),
  issues: many(moduleIssues),
}));

export const moduleIssuesRelations = relations(moduleIssues, ({ one }) => ({
  module: one(modules, {
    fields: [moduleIssues.moduleId],
    references: [modules.id],
  }),
  issue: one(issues, {
    fields: [moduleIssues.issueId],
    references: [issues.id],
  }),
}));
