import { z } from "zod";

import { prioritySchema, stateGroupSchema } from "@/lib/validators/issue";

/**
 * Filters for the cross-project assigned view.
 *
 * Deliberately a smaller set than the project view's. A state id, a label id
 * or a cycle id belongs to one project, so filtering by them across every
 * project a person can see is meaningless — the same "Todo" is a different row
 * in each. What survives is what is comparable everywhere: the state's group,
 * the priority, and the project itself.
 */

export const myIssueGroupBySchema = z.enum(["state_group", "priority", "project"]);

export type MyIssueGroupBy = z.infer<typeof myIssueGroupBySchema>;

export const myIssueOrderBySchema = z.enum([
  "priority",
  "target_date",
  "updated_at",
  "created_at",
]);

export const myIssueFilterSchema = z.object({
  stateGroups: z.array(stateGroupSchema).optional(),
  priorities: z.array(prioritySchema).optional(),
  projectIds: z.array(z.string().uuid()).max(50).optional(),
  /**
   * Completed and cancelled work is hidden by default. "My issues" is a
   * worklist, and a year of finished tickets at the top of it is the fastest
   * way to make the page useless.
   */
  includeClosed: z.boolean().default(false),
  search: z.string().trim().max(120).optional(),
  groupBy: myIssueGroupBySchema.default("state_group"),
  orderBy: myIssueOrderBySchema.default("priority"),
  limit: z.number().int().min(1).max(300).default(200),
});

export type MyIssueFilters = z.infer<typeof myIssueFilterSchema>;

export const DEFAULT_MY_ISSUE_FILTERS: MyIssueFilters =
  myIssueFilterSchema.parse({});
