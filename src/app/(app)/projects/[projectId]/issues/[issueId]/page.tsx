import { notFound } from "next/navigation";

import { IssuePageClient } from "@/app/(app)/projects/[projectId]/issues/[issueId]/issue-page-client";
import type { StateGroup } from "@/components/shared/state-icon";
import {
  getIssueActivity,
  getIssueAttachments,
  getIssueComments,
  getIssueDetail,
  getIssueLinks,
  getLabelOptions,
  getProjectCycles,
  getSubIssues,
} from "@/db/queries/issues";
import { getProjectMembers, getProjectStates } from "@/db/queries/project";
import { assertCan } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

interface IssuePageProps {
  params: Promise<{ projectId: string; issueId: string }>;
}

export default async function IssuePage({ params }: IssuePageProps) {
  const { projectId, issueId } = await params;
  const user = await requireUser();

  // Permission is checked before the issue is read, so a member of another team
  // gets the access message rather than a 404 that confirms the id exists.
  const readable = await assertCan(user, { kind: "project.read", projectId });
  if (!readable.ok) {
    return (
      <div className="mx-auto max-w-[720px] px-6 pt-8">
        <h1 className="text-lg font-medium text-text-100">
          You do not have access to this issue
        </h1>
        <p className="mt-1 text-sm text-text-300">
          It belongs to a project you are not a member of. Ask the team lead or
          a workspace admin for access.
        </p>
      </div>
    );
  }

  const issue = await getIssueDetail(issueId, user.id);
  if (!issue || issue.projectId !== projectId) notFound();

  const [
    subIssues,
    links,
    attachments,
    comments,
    activity,
    states,
    members,
    labels,
    cycles,
    canManage,
  ] = await Promise.all([
    getSubIssues(issueId),
    getIssueLinks(issueId),
    getIssueAttachments(issueId),
    getIssueComments(issueId),
    getIssueActivity(issueId),
    getProjectStates(projectId),
    getProjectMembers(projectId),
    getLabelOptions(projectId),
    getProjectCycles(projectId),
    assertCan(user, { kind: "project.manage", projectId }),
  ]);

  return (
    <div className="h-full">
      <IssuePageClient
        bundle={{ issue, subIssues, links, attachments, comments, activity }}
        states={states.map((state) => ({
          id: state.id,
          name: state.name,
          group: state.group as StateGroup,
          color: state.color,
        }))}
        members={members}
        labels={labels}
        cycles={cycles.map((cycle) => ({ id: cycle.id, name: cycle.name }))}
        currentUserId={user.id}
        canModerate={canManage.ok}
      />
    </div>
  );
}
