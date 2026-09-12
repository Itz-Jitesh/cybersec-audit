import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { appealKind, appealStatus, priority } from "@/db/schema/enums";
import { issues } from "@/db/schema/issues";
import { profiles } from "@/db/schema/profiles";
import { projects } from "@/db/schema/projects";

/**
 * A request that needs a team lead's decision before it takes effect.
 *
 * Two things go through it. A `create` appeal carries the issue someone wants
 * opened — title, description, priority — and holds no issue id, because the
 * issue does not exist until the appeal is approved. A `complete` appeal points
 * at an existing issue and asks for it to be marked done after inspection.
 *
 * One table rather than two: the columns, the decision flow, the notifications
 * and the lead's queue are the same for both, and splitting them would mean
 * every screen and every policy written twice.
 *
 * Approving a create appeal writes the issue and records its id in
 * createdIssueId, so the appeal stays an audit trail of who asked and who
 * agreed rather than being consumed and lost.
 */
export const issueAppeals = pgTable(
  "issue_appeals",
  {
    id: uuid().primaryKey().defaultRandom(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: appealKind().notNull(),
    status: appealStatus().notNull().default("pending"),
    /** The issue a completion appeal is about. Null for a create appeal. */
    issueId: uuid().references(() => issues.id, { onDelete: "cascade" }),
    /** The proposed issue title. Null for a completion appeal. */
    title: text(),
    descriptionHtml: text(),
    descriptionJson: jsonb(),
    proposedPriority: priority().notNull().default("none"),
    /** The requester's case: why this issue, or why it is finished. */
    note: text(),
    requestedBy: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    decidedBy: uuid().references(() => profiles.id, { onDelete: "set null" }),
    decidedAt: timestamp({ withTimezone: true }),
    /** The lead's reason, which matters most when the answer is no. */
    decisionNote: text(),
    /** The issue an approved create appeal produced. */
    createdIssueId: uuid().references(() => issues.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "issue_appeals_shape_check",
      sql`(${table.kind} = 'create' and ${table.issueId} is null and ${table.title} is not null)
          or (${table.kind} = 'complete' and ${table.issueId} is not null)`,
    ),
    check(
      "issue_appeals_title_length_check",
      sql`${table.title} is null or char_length(${table.title}) <= 500`,
    ),
    check(
      "issue_appeals_decision_check",
      sql`(${table.status} = 'pending' and ${table.decidedAt} is null)
          or (${table.status} <> 'pending')`,
    ),
    index("issue_appeals_project_id_status_idx").on(
      table.projectId,
      table.status,
      table.createdAt.desc(),
    ),
    index("issue_appeals_requested_by_idx").on(
      table.requestedBy,
      table.createdAt.desc(),
    ),
    index("issue_appeals_issue_id_idx")
      .on(table.issueId)
      .where(sql`issue_id is not null`),
  ],
);

export const issueAppealsRelations = relations(issueAppeals, ({ one }) => ({
  project: one(projects, {
    fields: [issueAppeals.projectId],
    references: [projects.id],
  }),
  issue: one(issues, {
    fields: [issueAppeals.issueId],
    references: [issues.id],
  }),
  requester: one(profiles, {
    fields: [issueAppeals.requestedBy],
    references: [profiles.id],
  }),
  decider: one(profiles, {
    fields: [issueAppeals.decidedBy],
    references: [profiles.id],
  }),
}));
