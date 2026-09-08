"use client";

import { listIssues } from "@/actions/issue-list";
import type { PartialFilters } from "@/components/issues/filter-bar";
import type { StateOption } from "@/components/issues/issue-row-dropdowns";
import { IssuesView } from "@/components/issues/issues-view";
import type { IssueLabelRef, IssueListItem } from "@/db/queries/issues";
import type { MemberRow } from "@/db/queries/project";

/**
 * The server component cannot hand a function across the boundary, so the
 * refetch closure is built here from the ids it can pass.
 */
export function IssuesClient(props: {
  projectId: string;
  initialIssues: IssueListItem[];
  states: StateOption[];
  members: MemberRow[];
  labels: IssueLabelRef[];
  cycles: { id: string; name: string }[];
  modules: { id: string; name: string }[];
  canDelete: boolean;
  canModerate: boolean;
  currentUserId: string;
}) {
  return (
    <IssuesView
      {...props}
      fetchIssues={async (filters?: PartialFilters) => {
        const result = await listIssues({
          projectId: props.projectId,
          ...filters,
        });
        if (!result.ok) throw new Error(result.error);
        return result.data;
      }}
    />
  );
}
