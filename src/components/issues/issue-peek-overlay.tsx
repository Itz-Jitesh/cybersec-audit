"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Maximize2 } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { loadIssueDetail } from "@/actions/issue-detail";
import type { StateOption } from "@/components/issues/issue-row-dropdowns";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { IssueLabelRef } from "@/db/queries/issues";
import type { MemberRow } from "@/db/queries/project";

/**
 * Loaded on demand. IssueDetail pulls in TipTap and ProseMirror, which is the
 * bulk of this route's JavaScript, and the overlay does not exist until someone
 * clicks a row. Static-importing it made every visitor to the list download an
 * editor they may never open.
 */
const IssueDetail = dynamic(
  () => import("@/components/issues/issue-detail").then((m) => m.IssueDetail),
  { ssr: false },
);

interface IssuePeekOverlayProps {
  issueId: string;
  projectId: string;
  states: StateOption[];
  cycles: { id: string; name: string }[];
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
  cycles,
  members,
  labels,
  currentUserId,
  canModerate,
  onClose,
}: IssuePeekOverlayProps) {
  const queryClient = useQueryClient();
  const queryKey = ["issue-detail", issueId] as const;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await loadIssueDetail({ issueId });
      if (!result.ok) {
        // The code travels with the error: a denial and a failed query are not
        // the same thing, and telling someone they lack access when the query
        // simply broke sends them to an admin for a permission they already
        // have.
        throw Object.assign(new Error(result.error), { code: result.code });
      }
      return result.data;
    },
    retry: false,
  });

  const denied =
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    (error.code === "FORBIDDEN" || error.code === "UNAUTHENTICATED");

  function refresh() {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ["issues", projectId] });
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton
        // Full screen on a phone, a centred panel from sm up. An 80vh dialog
        // inside a 100vw viewport leaves a strip of unreachable list behind it
        // and nothing to grab, which on touch reads as a stuck screen.
        className="h-dvh max-h-dvh w-screen max-w-none gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-[80vh] sm:max-h-[80vh] sm:w-full sm:max-w-[860px] sm:rounded-lg sm:border"
      >
        <DialogTitle className="sr-only">Issue detail</DialogTitle>

        {isLoading && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-text-300">
            <Loader2 size={16} className="animate-spin" />
            Loading…
          </div>
        )}

        {error && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium text-text-100">
              {denied
                ? "You do not have access to this issue"
                : "This issue could not be loaded"}
            </p>
            <p className="text-xs text-text-300">
              {error instanceof Error
                ? error.message
                : "Something went wrong. Try again."}
            </p>
            {!denied && (
              <Button
                size="sm"
                variant="secondary"
                className="mt-1"
                onClick={() => void refetch()}
              >
                Try again
              </Button>
            )}
          </div>
        )}

        {data && (
          <>
            <div className="flex h-9 shrink-0 items-center justify-end border-b border-border-subtle px-3">
              <Link
                href={`/projects/${data.issue.projectId}/issues/${data.issue.id}`}
                aria-label="Open in full page"
                className="mr-8 flex size-10 items-center justify-center rounded-sm text-text-400 hover:bg-bg-80 hover:text-text-100 sm:mr-6 sm:size-7"
              >
                <Maximize2 size={14} strokeWidth={1.5} />
              </Link>
            </div>
            <div className="min-h-0 flex-1">
              <IssueDetail
                {...data}
                states={states}
                cycles={cycles}
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
