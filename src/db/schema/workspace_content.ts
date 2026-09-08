import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { viewAccess } from "@/db/schema/enums";
import { profiles } from "@/db/schema/profiles";
import { projects } from "@/db/schema/projects";
import { teams } from "@/db/schema/teams";

/**
 * A view with neither project_id nor team_id set is workspace-level. The shapes
 * of filters and display_props are given in docs/04-DATA-MODEL.md §6 and are
 * validated by zod at the action boundary rather than by the database.
 */
export const views = pgTable("views", {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid().references(() => projects.id, { onDelete: "cascade" }),
  teamId: uuid().references(() => teams.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
  filters: jsonb().notNull().default({}),
  displayProps: jsonb().notNull().default({}),
  layout: text().notNull().default("list"),
  access: viewAccess().notNull().default("private"),
  ownerId: uuid()
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  createdBy: uuid()
    .notNull()
    .references(() => profiles.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const pages = pgTable("pages", {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid().references(() => projects.id, { onDelete: "cascade" }),
  teamId: uuid().references(() => teams.id, { onDelete: "cascade" }),
  title: text().notNull(),
  contentJson: jsonb(),
  contentHtml: text(),
  access: viewAccess().notNull().default("private"),
  ownerId: uuid()
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  isArchived: boolean().notNull().default(false),
  createdBy: uuid()
    .notNull()
    .references(() => profiles.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * entity_id is deliberately not a foreign key, because a favorite can point at
 * any of five different tables. Orphans are cleaned up when the entity is
 * deleted, in the same action that deletes it.
 */
export const favorites = pgTable(
  "favorites",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    entityType: text().notNull(),
    entityId: uuid().notNull(),
    sortOrder: doublePrecision().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("favorites_user_id_entity_type_entity_id_key").on(
      table.userId,
      table.entityType,
      table.entityId,
    ),
  ],
);

export const viewsRelations = relations(views, ({ one }) => ({
  project: one(projects, {
    fields: [views.projectId],
    references: [projects.id],
  }),
  team: one(teams, { fields: [views.teamId], references: [teams.id] }),
  owner: one(profiles, {
    fields: [views.ownerId],
    references: [profiles.id],
  }),
  creator: one(profiles, {
    fields: [views.createdBy],
    references: [profiles.id],
  }),
}));

export const pagesRelations = relations(pages, ({ one }) => ({
  project: one(projects, {
    fields: [pages.projectId],
    references: [projects.id],
  }),
  team: one(teams, { fields: [pages.teamId], references: [teams.id] }),
  owner: one(profiles, {
    fields: [pages.ownerId],
    references: [profiles.id],
  }),
  creator: one(profiles, {
    fields: [pages.createdBy],
    references: [profiles.id],
  }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(profiles, {
    fields: [favorites.userId],
    references: [profiles.id],
  }),
}));
