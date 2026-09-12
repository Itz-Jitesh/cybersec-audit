"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { CheckCircle2, CircleSlash, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { approveAppeal, cancelAppeal, rejectAppeal } from "@/actions/appeals";
import { MemberAvatar } from "@/components/shared/member-avatar";
import {
  type IssuePriority,
  PriorityIcon,
} from "@/components/shared/priority-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppealRow } from "@/db/queries/appeals";

const STATUS_ICON = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: CircleSlash,
  cancelled: CircleSlash,
} as const;

const STATUS_TEXT = {
  pending: "text-text-300",
  approved: "text-success",
  rejected: "text-danger",
  cancelled: "text-text-400",
} as const;

/**
 * The approver's queue. One row per request, pending ones first, with the two
 * buttons that are the whole point: approve writes the issue or completes it,
 * reject closes the request with a reason.
 *
 * The buttons are drawn from canDecide and hidden on your own appeal, but that
 * is presentation only — approveAppeal and rejectAppeal re-check the ability and
 * refuse a self-decision regardless of what this component chose to render.
 */
export function AppealsList({
  appeals,
  projectId,
  currentUserId,
  canDecide,
}: {
  appeals: AppealRow[];
  projectId: string;
  currentUserId: string;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function run(
    appealId: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
  ) {
    setBusyId(appealId);
    const result = await action();
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error ?? "That did not work.");
      return;
    }
    toast.success(success);
    setNoteFor(null);
    setNote("");
    router.refresh();
  }

  if (appeals.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-text-300">
        No requests yet. A member asking for an issue, or for one to be marked
        completed, appears here for a team lead to decide.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border-subtle">
      {appeals.map((appeal) => {
        const StatusIcon = STATUS_ICON[appeal.status];
        const mine = appeal.requestedById === currentUserId;
        const decidable = canDecide && appeal.status === "pending" && !mine;

        return (
          <li key={appeal.id} className="flex gap-3 px-4 py-3">
            <MemberAvatar
              user={{
                id: appeal.requestedById,
                displayName: appeal.requestedByName,
                avatarUrl: appeal.requestedByAvatar,
              }}
              size={24}
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xs tracking-wide text-text-400 uppercase">
                  {appeal.kind === "create" ? "New issue" : "Completion"}
                </span>
                {appeal.kind === "create" && (
                  <PriorityIcon
                    priority={appeal.proposedPriority as IssuePriority}
                    size={14}
                  />
                )}
                <span className="truncate text-sm text-text-100">
                  {appeal.kind === "create"
                    ? appeal.title
                    : (appeal.issueName ?? "An issue")}
                </span>
                <span
                  className={`flex items-center gap-1 text-xs ${STATUS_TEXT[appeal.status]}`}
                >
                  <StatusIcon size={12} strokeWidth={1.5} />
                  {appeal.status}
                </span>
              </div>

              <p className="mt-0.5 text-xs text-text-400">
                {appeal.requestedByName} ·{" "}
                {formatDistanceToNowStrict(new Date(appeal.createdAt), {
                  addSuffix: true,
                })}
                {appeal.decidedByName &&
                  ` · decided by ${appeal.decidedByName}`}
              </p>

              {appeal.note && (
                <p className="mt-1 text-sm text-text-200">{appeal.note}</p>
              )}

              {appeal.decisionNote && (
                <p className="mt-1 text-xs text-text-300">
                  Decision: {appeal.decisionNote}
                </p>
              )}

              {(appeal.createdIssueId ?? appeal.issueId) && (
                <Link
                  href={`/projects/${projectId}/issues/${appeal.createdIssueId ?? appeal.issueId}`}
                  className="mt-1 inline-block text-xs text-brand underline"
                >
                  Open the issue
                </Link>
              )}

              {noteFor === appeal.id && (
                <Input
                  autoFocus
                  value={note}
                  placeholder="Reason, optional"
                  onChange={(event) => setNote(event.target.value)}
                  className="mt-2 h-7"
                />
              )}
            </div>

            <div className="flex shrink-0 items-start gap-1.5">
              {decidable && (
                <>
                  <Button
                    size="sm"
                    disabled={busyId === appeal.id}
                    onClick={() =>
                      run(
                        appeal.id,
                        () =>
                          approveAppeal({
                            appealId: appeal.id,
                            decisionNote: note || undefined,
                          }),
                        appeal.kind === "create"
                          ? "Issue created."
                          : "Issue marked completed.",
                      )
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busyId === appeal.id}
                    onClick={() => {
                      if (noteFor !== appeal.id) {
                        setNoteFor(appeal.id);
                        setNote("");
                        return;
                      }
                      void run(
                        appeal.id,
                        () =>
                          rejectAppeal({
                            appealId: appeal.id,
                            decisionNote: note || undefined,
                          }),
                        "Request declined.",
                      );
                    }}
                  >
                    {noteFor === appeal.id ? "Confirm decline" : "Decline"}
                  </Button>
                </>
              )}

              {mine && appeal.status === "pending" && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === appeal.id}
                  onClick={() =>
                    run(
                      appeal.id,
                      () => cancelAppeal({ appealId: appeal.id }),
                      "Request withdrawn.",
                    )
                  }
                >
                  Withdraw
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
