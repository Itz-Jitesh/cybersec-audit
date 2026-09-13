"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  assignIssuesToCycle,
  searchCycleCandidateIssues,
} from "@/actions/cycles";
import { IssueIdBadge } from "@/components/shared/issue-id-badge";
import { type StateGroup, StateIcon } from "@/components/shared/state-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Candidate = {
  id: string;
  name: string;
  sequenceId: number;
  identifier: string;
  stateGroup: StateGroup;
  stateColor: string;
};

export interface CycleIssue {
  id: string;
  name: string;
  sequenceId: number;
  identifier: string;
  stateGroup: StateGroup;
  stateColor: string;
}

interface CycleIssuePanelProps {
  cycleId: string;
  projectId: string;
  issues: CycleIssue[];
  canWrite: boolean;
}

/**
 * The issue list on a cycle, with attach and detach — the counterpart of
 * ModuleIssuePanel, which cycles never had.
 *
 * assignIssuesToCycle already existed, fully written and guarded, with no caller
 * anywhere in the interface. The only way to put an issue in a cycle was the
 * Cycle chip in the create modal, at the moment of creation and never after, so
 * an issue created before a cycle existed could not be pulled into it at all.
 *
 * Both writes refresh the server component rather than patching locally,
 * because the header's totals and the burndown are rendered from the same rows
 * and a local patch would leave them disagreeing until the next navigation.
 */
export function CycleIssuePanel({
  cycleId,
  projectId,
  issues,
  canWrite,
}: CycleIssuePanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pending, startTransition] = useTransition();

  const attached = new Set(issues.map((issue) => issue.id));

  // Debounced at 200ms, the figure docs/06-UX-LAYOUT-SPEC.md §13 sets for
  // search inputs.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await searchCycleCandidateIssues({ cycleId, query });
        if (result.ok) setCandidates(result.data as Candidate[]);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [open, query, cycleId]);

  function attach(issueId: string) {
    startTransition(async () => {
      const result = await assignIssuesToCycle({
        cycleId,
        issueIds: [issueId],
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not add that issue.");
        return;
      }
      toast.success("Issue added to the cycle.");
      router.refresh();
    });
  }

  function detach(issueId: string) {
    startTransition(async () => {
      // A null cycle is the backlog, which is what removing from a cycle means.
      const result = await assignIssuesToCycle({
        cycleId: null,
        issueIds: [issueId],
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not remove that issue.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xs font-medium tracking-wide text-text-400 uppercase">
          Issues · {issues.length}
        </h2>
        {canWrite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary" className="gap-1.5">
                <Plus size={13} strokeWidth={1.5} />
                Add issues
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px]">
              <DialogHeader>
                <DialogTitle>Add issues to this cycle</DialogTitle>
              </DialogHeader>
              <Input
                autoFocus
                value={query}
                placeholder="Search this project's issues…"
                onChange={(event) => setQuery(event.target.value)}
              />
              <ul className="max-h-[320px] overflow-y-auto">
                {candidates.length === 0 && (
                  <li className="py-6 text-center text-xs text-text-400">
                    {pending ? "Searching…" : "No issues match."}
                  </li>
                )}
                {candidates.map((candidate) => {
                  const already = attached.has(candidate.id);
                  return (
                    <li
                      key={candidate.id}
                      className="flex h-9 items-center gap-2 border-b border-border-subtle px-1 last:border-b-0"
                    >
                      <StateIcon
                        group={candidate.stateGroup}
                        color={candidate.stateColor}
                        size={14}
                      />
                      <IssueIdBadge
                        identifier={candidate.identifier}
                        sequenceId={candidate.sequenceId}
                      />
                      <span className="min-w-0 flex-1 truncate text-xs text-text-100">
                        {candidate.name}
                      </span>
                      <Button
                        size="sm"
                        variant={already ? "ghost" : "secondary"}
                        disabled={already || pending}
                        onClick={() => attach(candidate.id)}
                      >
                        {already ? "Added" : "Add"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {issues.length === 0 ? (
        <p className="mt-2 text-xs text-text-400">
          No issues in this cycle yet.
          {canWrite && " Use Add issues to pull some in."}
        </p>
      ) : (
        <ul className="mt-2 overflow-hidden rounded-md border border-border-subtle">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className="flex h-9 items-center gap-2.5 border-b border-border-subtle px-3 last:border-b-0"
            >
              <StateIcon
                group={issue.stateGroup}
                color={issue.stateColor}
                size={14}
              />
              <IssueIdBadge
                identifier={issue.identifier}
                sequenceId={issue.sequenceId}
              />
              <Link
                href={`/projects/${projectId}/issues/${issue.id}`}
                className="min-w-0 flex-1 truncate text-xs text-text-100 hover:underline"
              >
                {issue.name}
              </Link>
              {canWrite && (
                <button
                  type="button"
                  aria-label={`Remove ${issue.name} from this cycle`}
                  disabled={pending}
                  onClick={() => detach(issue.id)}
                  className="flex size-6 items-center justify-center rounded-sm text-text-400 hover:bg-bg-70 hover:text-text-100"
                >
                  <X size={13} strokeWidth={1.5} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
