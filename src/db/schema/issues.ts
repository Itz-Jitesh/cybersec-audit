import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { cycles } from "@/db/schema/cycles";
import { priority, relationType } from "@/db/schema/enums";
import { profiles } from "@/db/schema/profiles";
import { labels, projects, states } from "@/db/schema/projects";

export const issues = pgTable(
  "issues",
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Assigned by the assign_issue_sequence trigger, never by the client. */
    sequenceId: integer().notNull(),
    name: text().notNull(),
    /** Rendered TipTap output, used for display and full-text search. */
    descriptionHtml: text(),
    /** The TipTap document, which is the source of truth when editing. */
    descriptionJson: jsonb(),
    stateId: uuid()
      .notNull()
      .references(() => states.id),
    priority: priority().notNull().default("none"),
    parentId: uuid().references((): AnyPgColumn => issues.id, {
      onDelete: "set null",
    }),
    cycleId: uuid().references(() => cycles.id, { onDelete: "set null" }),
    startDate: date(),
    targetDate: date(),
    estimatePoint: smallint(),
    /** Manual ordering within a group. Fractional to allow insert-between. */
    sortOrder: doublePrecision().notNull(),
    createdBy: uuid()
      .notNull()
      .references(() => profiles.id),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("issues_project_id_sequence_id_key").on(
      table.projectId,
      table.sequenceId,
    ),
    check("issues_name_length_check", sql`char_length(${table.name}) <= 500`),
    check(
      "issues_estimate_point_check",
      sql`${table.estimatePoint} is null or (${table.estimatePoint} >= 0 and ${table.estimatePoint} <= 21)`,
    ),
    index("issues_project_id_state_id_idx").on(table.projectId, table.stateId),
    index("issues_project_id_sort_order_idx").on(
      table.projectId,
      table.sortOrder,
    ),
    index("issues_cycle_id_idx")
      .on(table.cycleId)
      .where(sql`cycle_id is not null`),
    index("issues_parent_id_idx")
      .on(table.parentId)
      .where(sql`parent_id is not null`),
    index("issues_target_date_idx")
      .on(table.targetDate)
      .where(sql`target_date is not null`),
  ],
);

export const issueAssignees = pgTable(
  "issue_assignees",
  {
    id: uuid().primaryKey().defaultRandom(),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("issue_assignees_issue_id_user_id_key").on(
      table.issueId,
      table.userId,
    ),
    index("issue_assignees_user_id_idx").on(table.userId),
  ],
);

export const issueLabels = pgTable(
  "issue_labels",
  {
    id: uuid().primaryKey().defaultRandom(),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    labelId: uuid()
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("issue_labels_issue_id_label_id_key").on(
      table.issueId,
      table.labelId,
    ),
    index("issue_labels_label_id_idx").on(table.labelId),
  ],
);

/**
 * The inverse row for blocks and blocked_by is created by the application, not
 * by a trigger, so that a user removing one direction removes both explicitly.
 */
export const issueRelations = pgTable(
  "issue_relations",
  {
    id: uuid().primaryKey().defaultRandom(),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    relatedIssueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    relationType: relationType().notNull(),
    createdBy: uuid()
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("issue_relations_issue_id_related_issue_id_relation_type_key").on(
      table.issueId,
      table.relatedIssueId,
      table.relationType,
    ),
    check(
      "issue_relations_not_self_check",
      sql`${table.issueId} <> ${table.relatedIssueId}`,
    ),
  ],
);

export const issueLinks = pgTable("issue_links", {
  id: uuid().primaryKey().defaultRandom(),
  issueId: uuid()
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  url: text().notNull(),
  title: text(),
  createdBy: uuid()
    .notNull()
    .references(() => profiles.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Files live in the Supabase Storage bucket "attachments". */
export const issueAttachments = pgTable("issue_attachments", {
  id: uuid().primaryKey().defaultRandom(),
  issueId: uuid()
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  storagePath: text().notNull(),
  fileName: text().notNull(),
  fileSize: bigint({ mode: "number" }).notNull(),
  mimeType: text().notNull(),
  uploadedBy: uuid()
    .notNull()
    .references(() => profiles.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Append-only. Written by triggers only; there is deliberately no insert policy
 * for the authenticated role. old_display and new_display are denormalised at
 * write time so a deleted label or cycle still renders in the feed.
 */
export const issueActivity = pgTable(
  "issue_activity",
  {
    id: uuid().primaryKey().defaultRandom(),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    actorId: uuid()
      .notNull()
      .references(() => profiles.id),
    field: text().notNull(),
    oldValue: text(),
    newValue: text(),
    oldDisplay: text(),
    newDisplay: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("issue_activity_issue_id_created_at_idx").on(
      table.issueId,
      table.createdAt.desc(),
    ),
  ],
);

/** Auto-created for the creator, assignees and commenters by auto_subscribe. */
export const issueSubscribers = pgTable(
  "issue_subscribers",
  {
    id: uuid().primaryKey().defaultRandom(),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("issue_subscribers_issue_id_user_id_key").on(
      table.issueId,
      table.userId,
    ),
  ],
);

export const issuesRelations = relations(issues, ({ one, many }) => ({
  project: one(projects, {
    fields: [issues.projectId],
    references: [projects.id],
  }),
  state: one(states, { fields: [issues.stateId], references: [states.id] }),
  cycle: one(cycles, { fields: [issues.cycleId], references: [cycles.id] }),
  parent: one(issues, {
    fields: [issues.parentId],
    references: [issues.id],
    relationName: "issue_parent",
  }),
  subIssues: many(issues, { relationName: "issue_parent" }),
  creator: one(profiles, {
    fields: [issues.createdBy],
    references: [profiles.id],
  }),
  assignees: many(issueAssignees),
  labels: many(issueLabels),
  links: many(issueLinks),
  attachments: many(issueAttachments),
  activity: many(issueActivity),
  subscribers: many(issueSubscribers),
  outgoingRelations: many(issueRelations, {
    relationName: "relation_source",
  }),
  incomingRelations: many(issueRelations, {
    relationName: "relation_target",
  }),
}));

export const issueAssigneesRelations = relations(issueAssignees, ({ one }) => ({
  issue: one(issues, {
    fields: [issueAssignees.issueId],
    references: [issues.id],
  }),
  user: one(profiles, {
    fields: [issueAssignees.userId],
    references: [profiles.id],
  }),
}));

export const issueLabelsRelations = relations(issueLabels, ({ one }) => ({
  issue: one(issues, {
    fields: [issueLabels.issueId],
    references: [issues.id],
  }),
  label: one(labels, {
    fields: [issueLabels.labelId],
    references: [labels.id],
  }),
}));

export const issueRelationsRelations = relations(issueRelations, ({ one }) => ({
  issue: one(issues, {
    fields: [issueRelations.issueId],
    references: [issues.id],
    relationName: "relation_source",
  }),
  relatedIssue: one(issues, {
    fields: [issueRelations.relatedIssueId],
    references: [issues.id],
    relationName: "relation_target",
  }),
  creator: one(profiles, {
    fields: [issueRelations.createdBy],
    references: [profiles.id],
  }),
}));

export const issueLinksRelations = relations(issueLinks, ({ one }) => ({
  issue: one(issues, { fields: [issueLinks.issueId], references: [issues.id] }),
  creator: one(profiles, {
    fields: [issueLinks.createdBy],
    references: [profiles.id],
  }),
}));

export const issueAttachmentsRelations = relations(
  issueAttachments,
  ({ one }) => ({
    issue: one(issues, {
      fields: [issueAttachments.issueId],
      references: [issues.id],
    }),
    uploader: one(profiles, {
      fields: [issueAttachments.uploadedBy],
      references: [profiles.id],
    }),
  }),
);

export const issueActivityRelations = relations(issueActivity, ({ one }) => ({
  issue: one(issues, {
    fields: [issueActivity.issueId],
    references: [issues.id],
  }),
  actor: one(profiles, {
    fields: [issueActivity.actorId],
    references: [profiles.id],
  }),
}));

export const issueSubscribersRelations = relations(
  issueSubscribers,
  ({ one }) => ({
    issue: one(issues, {
      fields: [issueSubscribers.issueId],
      references: [issues.id],
    }),
    user: one(profiles, {
      fields: [issueSubscribers.userId],
      references: [profiles.id],
    }),
  }),
);
