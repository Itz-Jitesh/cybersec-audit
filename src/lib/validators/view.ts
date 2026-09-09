import { z } from "zod";

import {
  groupBySchema,
  issueFilterSchema,
  orderBySchema,
} from "@/lib/validators/issue";

/**
 * Views and display properties.
 *
 * The shapes here are the ones docs/04-DATA-MODEL.md §6 gives for the `filters`
 * and `display_props` jsonb columns. The database stores them unvalidated, so
 * this file is the only thing standing between arbitrary JSON and the query
 * builder — both on the way in and on the way back out, since a row written
 * before a shape changed is just as untrusted as a request body.
 */

export const layoutSchema = z.enum([
  "list",
  "kanban",
  "calendar",
  "spreadsheet",
]);

export type IssueLayout = z.infer<typeof layoutSchema>;

/** Which columns and chips a layout draws. Every one defaults to shown. */
export const displayPropertiesSchema = z.object({
  id: z.boolean().default(true),
  priority: z.boolean().default(true),
  state: z.boolean().default(true),
  assignee: z.boolean().default(true),
  labels: z.boolean().default(true),
  dueDate: z.boolean().default(true),
  estimate: z.boolean().default(false),
  subIssueCount: z.boolean().default(true),
});

export type DisplayProperties = z.infer<typeof displayPropertiesSchema>;

export const displayPropsSchema = z.object({
  groupBy: groupBySchema.default("state"),
  orderBy: orderBySchema.default("sort_order"),
  showSubIssues: z.boolean().default(true),
  properties: displayPropertiesSchema.prefault({}),
});

export type DisplayProps = z.infer<typeof displayPropsSchema>;

export const DEFAULT_DISPLAY_PROPS: DisplayProps = displayPropsSchema.parse({});

/**
 * The filter half of a saved view. projectId is dropped: a view is already
 * scoped by the row's project_id, and letting a saved blob name its own project
 * would be a way to read another project's issues through a view you own.
 */
export const savedFilterSchema = issueFilterSchema.omit({ projectId: true });

export type SavedFilters = z.infer<typeof savedFilterSchema>;

export const viewAccessSchema = z.enum(["private", "public"]);

export const createViewSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  filters: savedFilterSchema,
  displayProps: displayPropsSchema,
  layout: layoutSchema,
  access: viewAccessSchema.default("private"),
});

export const updateViewSchema = z.object({
  viewId: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  filters: savedFilterSchema.optional(),
  displayProps: displayPropsSchema.optional(),
  layout: layoutSchema.optional(),
  access: viewAccessSchema.optional(),
});

export const viewIdSchema = z.object({ viewId: z.string().uuid() });

export const duplicateViewSchema = z.object({
  viewId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

/**
 * Reading a stored blob back. A row written before a shape changed, or written
 * by hand, must not be able to reach the query builder — so a parse failure
 * falls back to the defaults rather than throwing a view list into an error.
 */
export function parseStoredFilters(value: unknown): SavedFilters {
  const parsed = savedFilterSchema.safeParse(value);
  return parsed.success ? parsed.data : savedFilterSchema.parse({});
}

export function parseStoredDisplayProps(value: unknown): DisplayProps {
  const parsed = displayPropsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_DISPLAY_PROPS;
}

export function parseStoredLayout(value: unknown): IssueLayout {
  const parsed = layoutSchema.safeParse(value);
  return parsed.success ? parsed.data : "list";
}
