import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { workspaceMembers } from "@/db/schema/workspace";

/**
 * Mirrors auth.users. Rows are created only by the handle_new_user trigger,
 * which copies the id straight from the new auth user.
 *
 * auth.users is deliberately not modelled in Drizzle. Declaring it here made
 * drizzle-kit emit a CREATE TABLE for a table Supabase already owns, so the
 * foreign key from profiles.id to auth.users.id, along with its ON DELETE
 * CASCADE, is added by hand in supabase/migrations/0003_triggers.sql instead.
 */
export const profiles = pgTable("profiles", {
  id: uuid().primaryKey(),
  email: text().notNull().unique(),
  displayName: text().notNull(),
  avatarUrl: text(),
  bio: text(),
  githubHandle: text(),
  linkedinUrl: text(),
  lastSeenAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const profilesRelations = relations(profiles, ({ one }) => ({
  membership: one(workspaceMembers, {
    fields: [profiles.id],
    references: [workspaceMembers.userId],
  }),
}));
