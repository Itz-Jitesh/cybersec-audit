import { z } from "zod";

export const prioritySchema = z.enum([
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]);

export const relationTypeSchema = z.enum([
  "blocks",
  "blocked_by",
  "relates_to",
  "duplicate_of",
]);

/** Matches the 500-character check constraint on issues.name. */
const titleSchema = z
  .string()
  .trim()
  .min(1, "A title is required.")
  .max(500, "Titles are limited to 500 characters.");

/** Fibonacci-ish, 0 to 21, matching the check constraint on estimate_point. */
const estimateSchema = z.number().int().min(0).max(21).nullable().optional();

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a calendar date.")
  .nullable()
  .optional();

export const createIssueSchema = z.object({
  projectId: z.string().uuid(),
  name: titleSchema,
  descriptionHtml: z.string().optional(),
  descriptionJson: z.unknown().optional(),
  /** Absent means the project's default state, resolved server-side. */
  stateId: z.string().uuid().optional(),
  priority: prioritySchema.default("none"),
  parentId: z.string().uuid().nullable().optional(),
  cycleId: z.string().uuid().nullable().optional(),
  moduleIds: z.array(z.string().uuid()).max(20).optional(),
  assigneeIds: z.array(z.string().uuid()).max(20).optional(),
  labelIds: z.array(z.string().uuid()).max(20).optional(),
  startDate: dateSchema,
  targetDate: dateSchema,
  estimatePoint: estimateSchema,
});

export const updateIssueSchema = z.object({
  issueId: z.string().uuid(),
  name: titleSchema.optional(),
  descriptionHtml: z.string().optional(),
  descriptionJson: z.unknown().optional(),
  stateId: z.string().uuid().optional(),
  priority: prioritySchema.optional(),
  parentId: z.string().uuid().nullable().optional(),
  cycleId: z.string().uuid().nullable().optional(),
  startDate: dateSchema,
  targetDate: dateSchema,
  estimatePoint: estimateSchema,
});

/**
 * A drag can change an issue's group and its position at once, so both travel
 * in one call. Sending them separately would write two activity rows and let
 * the row flicker between two intermediate states.
 */
export const updateIssueOrderSchema = z.object({
  issueId: z.string().uuid(),
  /** The state the issue lands in. Unchanged when reordering within a group. */
  stateId: z.string().uuid(),
  beforeId: z.string().uuid().nullable(),
  afterId: z.string().uuid().nullable(),
});

export const issueIdSchema = z.object({ issueId: z.string().uuid() });

export const setAssigneesSchema = z.object({
  issueId: z.string().uuid(),
  userIds: z.array(z.string().uuid()).max(20),
});

export const setLabelsSchema = z.object({
  issueId: z.string().uuid(),
  labelIds: z.array(z.string().uuid()).max(20),
});

export const setParentSchema = z.object({
  issueId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
});

export const relationSchema = z.object({
  issueId: z.string().uuid(),
  relatedIssueId: z.string().uuid(),
  relationType: relationTypeSchema,
});

/**
 * z.url() accepts javascript: and data:, both of which execute when the stored
 * value is later rendered as an href. Only the two schemes a link on an issue
 * should ever use are allowed.
 */
export const linkUrlSchema = z
  .string()
  .trim()
  .url("That does not look like a link.")
  .refine(
    (value) => /^https?:\/\//i.test(value),
    "Links must start with http:// or https://.",
  );

export const addLinkSchema = z.object({
  issueId: z.string().uuid(),
  url: linkUrlSchema,
  title: z.string().trim().max(200).optional().or(z.literal("")),
});

export const linkIdSchema = z.object({ linkId: z.string().uuid() });

export const addAttachmentSchema = z.object({
  issueId: z.string().uuid(),
  storagePath: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().min(0),
  mimeType: z.string().min(1).max(255),
});

export const attachmentIdSchema = z.object({
  attachmentId: z.string().uuid(),
});

/**
 * Bulk edits are one call carrying many ids, not a loop of calls from the
 * client. A loop would be N round trips, N revalidations and a partially
 * applied result if the tab closed halfway.
 */
export const bulkUpdateSchema = z.object({
  issueIds: z.array(z.string().uuid()).min(1).max(200),
  stateId: z.string().uuid().optional(),
  priority: prioritySchema.optional(),
  addAssigneeIds: z.array(z.string().uuid()).max(20).optional(),
  addLabelIds: z.array(z.string().uuid()).max(20).optional(),
  archive: z.boolean().optional(),
});

/** Grouping is fixed to state in phase 8; the rest arrive with the filter bar. */
export const issueFilterSchema = z.object({
  projectId: z.string().uuid(),
  stateIds: z.array(z.string().uuid()).optional(),
  priorities: z.array(prioritySchema).optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  labelIds: z.array(z.string().uuid()).optional(),
  cycleIds: z.array(z.string().uuid()).optional(),
  search: z.string().trim().max(200).optional(),
  includeArchived: z.boolean().default(false),
  limit: z.number().int().min(1).max(500).default(200),
  offset: z.number().int().min(0).default(0),
});

export type IssueFilters = z.infer<typeof issueFilterSchema>;
export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type IssuePriority = z.infer<typeof prioritySchema>;
