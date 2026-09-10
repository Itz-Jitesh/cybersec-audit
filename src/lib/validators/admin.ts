import { z } from "zod";

/**
 * Admin panel input. Every schema here guards an operation that changes who
 * can do what, so the shapes are deliberately narrow: a role is one of four
 * literals, never a free string, and a bulk invite is bounded.
 */

export const workspaceRoleSchema = z.enum([
  "admin",
  "president",
  "co_president",
  "mentor",
  "member",
]);

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const teamRoleSchema = z.enum(["lead", "member"]);

/** Twenty club members at a time is the batch the PRD describes. */
const MAX_BATCH = 40;

/**
 * Emails arrive from a textarea as a comma- or newline-separated list, which is
 * split and de-duplicated here so the action never has to parse anything.
 */
export const bulkInviteSchema = z.object({
  emails: z
    .string()
    .trim()
    .min(1, "Enter at least one email address.")
    .transform((value) =>
      Array.from(
        new Set(
          value
            .split(/[\s,;]+/)
            .map((part) => part.trim().toLowerCase())
            .filter((part) => part.length > 0),
        ),
      ),
    )
    .pipe(
      z
        .array(z.string().email("That is not an email address."))
        .min(1)
        .max(MAX_BATCH, `Send at most ${MAX_BATCH} invites at a time.`),
    ),
  role: workspaceRoleSchema.default("member"),
  teamId: z.string().uuid().nullable().optional(),
  teamRole: teamRoleSchema.default("member"),
});

export const inviteIdSchema = z.object({ inviteId: z.string().uuid() });

export const changeRoleSchema = z.object({
  userId: z.string().uuid(),
  role: workspaceRoleSchema,
});

export const setActiveSchema = z.object({
  userId: z.string().uuid(),
  isActive: z.boolean(),
});

export const auditPageSchema = z.object({
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).default(0),
});
