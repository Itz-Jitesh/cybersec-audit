import { z } from "zod";

/**
 * Shared by the forms and the server actions, so a rule cannot be enforced in
 * one place and forgotten in the other.
 */

export const teamSlugSchema = z
  .string()
  .trim()
  .min(2, "Slug must be at least 2 characters.")
  .max(32, "Slug must be at most 32 characters.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens.",
  );

export const createTeamSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(60),
  slug: teamSlugSchema,
  description: z.string().trim().max(500).optional().or(z.literal("")),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour from the palette."),
  logoEmoji: z.string().trim().max(8).optional().or(z.literal("")),
});

export const updateTeamSchema = createTeamSchema.partial().extend({
  teamId: z.string().uuid(),
});

export const deleteTeamSchema = z.object({
  teamId: z.string().uuid(),
  /** Typed by the user to confirm; compared against the team name in the action. */
  confirmation: z.string(),
});

export const teamMemberSchema = z.object({
  teamId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const teamRoleSchema = z.enum(["lead", "member"]);

export const setTeamRoleSchema = teamMemberSchema.extend({
  role: teamRoleSchema,
});

/**
 * Adding carries a role because the picker offers one. It defaults to member
 * so an omitted field cannot silently promote somebody.
 */
export const addTeamMemberSchema = teamMemberSchema.extend({
  role: teamRoleSchema.default("member"),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type TeamMemberRole = z.infer<typeof teamRoleSchema>;
