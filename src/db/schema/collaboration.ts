import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { notificationType } from "@/db/schema/enums";
import { issues } from "@/db/schema/issues";
import { profiles } from "@/db/schema/profiles";

/**
 * docs/04-DATA-MODEL.md references comments in its index list, trigger table and
 * RLS matrix but does not give the column list, so the columns here follow the
 * feature description in docs/02-PRD.md §4: rich text, @mentions and reactions,
 * with edit and delete restricted to the author. Mentioned users are parsed out
 * of content_html by fanout_notifications, which reads data-mention-id
 * attributes, so mentions need no table of their own.
 */
export const comments = pgTable(
  "comments",
  {
    id: uuid().primaryKey().defaultRandom(),
    issueId: uuid()
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    authorId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    contentHtml: text().notNull(),
    contentJson: jsonb(),
    isEdited: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("comments_issue_id_created_at_idx").on(
      table.issueId,
      table.createdAt,
    ),
  ],
);

export const commentReactions = pgTable(
  "comment_reactions",
  {
    id: uuid().primaryKey().defaultRandom(),
    commentId: uuid()
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    emoji: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("comment_reactions_comment_id_user_id_emoji_key").on(
      table.commentId,
      table.userId,
      table.emoji,
    ),
  ],
);

/** Written by the fanout_notifications trigger only. */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    issueId: uuid().references(() => issues.id, { onDelete: "cascade" }),
    actorId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    type: notificationType().notNull(),
    title: text().notNull(),
    body: text(),
    readAt: timestamp({ withTimezone: true }),
    snoozedTill: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_id_read_at_created_at_idx").on(
      table.userId,
      table.readAt,
      table.createdAt.desc(),
    ),
  ],
);

export const commentsRelations = relations(comments, ({ one, many }) => ({
  issue: one(issues, { fields: [comments.issueId], references: [issues.id] }),
  author: one(profiles, {
    fields: [comments.authorId],
    references: [profiles.id],
  }),
  reactions: many(commentReactions),
}));

export const commentReactionsRelations = relations(
  commentReactions,
  ({ one }) => ({
    comment: one(comments, {
      fields: [commentReactions.commentId],
      references: [comments.id],
    }),
    user: one(profiles, {
      fields: [commentReactions.userId],
      references: [profiles.id],
    }),
  }),
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(profiles, {
    fields: [notifications.userId],
    references: [profiles.id],
  }),
  actor: one(profiles, {
    fields: [notifications.actorId],
    references: [profiles.id],
  }),
  issue: one(issues, {
    fields: [notifications.issueId],
    references: [issues.id],
  }),
}));
