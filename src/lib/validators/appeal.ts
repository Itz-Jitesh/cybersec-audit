import { z } from "zod";

import { prioritySchema } from "@/lib/validators/issue";

/** Matches the 500-character check constraint on issue_appeals.title. */
const titleSchema = z
  .string()
  .trim()
  .min(1, "A title is required.")
  .max(500, "Titles are limited to 500 characters.");

const noteSchema = z
  .string()
  .trim()
  .max(2_000, "Keep the note under 2000 characters.")
  .optional();

/** A request to open an issue, which a lead turns into the real thing. */
export const createIssueAppealSchema = z.object({
  projectId: z.string().uuid(),
  title: titleSchema,
  descriptionHtml: z.string().max(50_000).optional(),
  descriptionJson: z.unknown().optional(),
  proposedPriority: prioritySchema.default("none"),
  note: noteSchema,
});

/** A request to mark an existing issue completed, pending inspection. */
export const completionAppealSchema = z.object({
  issueId: z.string().uuid(),
  note: noteSchema,
});

export const appealIdSchema = z.object({
  appealId: z.string().uuid(),
});

export const decideAppealSchema = z.object({
  appealId: z.string().uuid(),
  decisionNote: z
    .string()
    .trim()
    .max(2_000, "Keep the note under 2000 characters.")
    .optional(),
});

export const listAppealsSchema = z.object({
  projectId: z.string().uuid(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
});
