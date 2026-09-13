"use client";

import { useRouter } from "next/navigation";

import {
  IssueDetail,
  type IssueDetailBundle,
} from "@/components/issues/issue-detail";
import type { StateOption } from "@/components/issues/issue-row-dropdowns";
import type { IssueLabelRef } from "@/db/queries/issues";
import type { MemberRow } from "@/db/queries/project";

/**
 * The full-page mounting of IssueDetail. It refreshes through the router rather
 * than a query cache, because on this route the server render is the source of
 * truth and there is no surrounding list to keep in step.
 */
export function IssuePageClient({
  bundle,
  states,
  cycles,
  members,
  labels,
  currentUserId,
  canModerate,
}: {
  bundle: IssueDetailBundle;
  states: StateOption[];
  cycles: { id: string; name: string }[];
  members: MemberRow[];
  labels: IssueLabelRef[];
  currentUserId: string;
  canModerate: boolean;
}) {
  const router = useRouter();

  return (
    <IssueDetail
      {...bundle}
      states={states}
      cycles={cycles}
      members={members}
      labels={labels}
      currentUserId={currentUserId}
      canModerate={canModerate}
      onChanged={() => router.refresh()}
    />
  );
}
