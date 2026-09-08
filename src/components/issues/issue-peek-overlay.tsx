"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Maximize2 } from "lucide-react";
import Link from "next/link";

import { loadIssueDetail } from "@/actions/issue-detail";
import { IssueDetail } from "@/components/issues/issue-detail";
import type { StateOption } from "@/components/issues/issue-row-dropdowns";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { IssueLabelRef } from "@/db/queries/issues";
import type { MemberRow } from "@/db/queries/project";

interface IssuePeekOverlayProps {
  issueId: string;
  projectId: string;
  states: StateOption[];
  members: MemberRow[];
  labels: IssueLabelRef[];
  currentUserId: string;
  canModerate: boolean;
  onClose: () => void;
}

/**
 * The same IssueDetail the full page renders, in a Dialog. Opening an issue
 * from a list should not lose the list, which is the whole reason the peek
 * exists — so this navigates nowhere and Esc returns you exactly where you were.
 */
export function IssuePeekOverlay({
  issueId,
  projectId,
  states,
  members,
  labels,
  currentUserId,
  canModerate,
  onClose,
}: IssuePeekOverlayProps) {
  const queryClient = useQueryClient();
  const queryKey = ["issue-detail", issueId] as const;

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await loadIssueDetail({ issueId });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton
        className="h-[80vh] max-w-[860px] gap-0 overflow-hidden p-0 sm:max-w-[860px]"
      >
        <DialogTitle className="sr-only">Issue detail</DialogTitle>

        {isLoading && (
          <div className="text-text-300 flex h-full items-center justify-center gap-2 text-sm">
            <Loader2 size={16} className="animate-spin" />
            Loading…
          </div>
        )}

        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-text-100 text-sm font-medium">
              You do not have access to this issue
            </p>
            <p className="text-text-300 text-xs">
              {error instanceof Error ? error.message : "Access denied."}
            </p>
          </div>
        )}

        {data && (
          <>
            <div className="border-border-subtle flex h-9 shrink-0 items-center justify-end border-b px-3">
              <Link
                href={`/projects/${data.issue.projectId}/issues/${data.issue.id}`}
                aria-label="Open in full page"
                className="text-text-400 hover:bg-bg-80 hover:text-text-100 mr-6 rounded-sm p-1"
              >
                <Maximize2 size={14} strokeWidth={1.5} />
              </Link>
            </div>
            <div className="min-h-0 flex-1">
              <IssueDetail
                {...data}
                states={states}
                members={members}
                labels={labels}
                currentUserId={currentUserId}
                canModerate={canModerate}
                onChanged={refresh}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
