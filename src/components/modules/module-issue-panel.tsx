"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addIssuesToModule,
  removeIssueFromModule,
  searchModuleCandidateIssues,
} from "@/actions/modules";
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
import type { IssueListItem } from "@/db/queries/issues";

type Candidate = {
  id: string;
  name: string;
  sequenceId: number;
  identifier: string;
  stateGroup: StateGroup;
  stateColor: string;
};

interface ModuleIssuePanelProps {
  moduleId: string;
  projectId: string;
  issues: IssueListItem[];
  canWrite: boolean;
}

/**
 * The issue list on a module, with attach and detach.
 *
 * Both writes go through the module actions and then refresh the server
 * component rather than patching locally: the module header's progress ring is
 * server-rendered from the same rows, so a local patch would leave the two
 * disagreeing until the next navigation.
 */
export function ModuleIssuePanel({
  moduleId,
  projectId,
  issues,
  canWrite,
}: ModuleIssuePanelProps) {
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
        const result = await searchModuleCandidateIssues({ moduleId, query });
        if (result.ok) setCandidates(result.data as Candidate[]);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [open, query, moduleId]);

  function attach(issueId: string) {
    startTransition(async () => {
      const result = await addIssuesToModule({ moduleId, issueIds: [issueId] });
      if (!result.ok) {
        toast.error(result.error ?? "Could not attach that issue.");
        return;
      }
      toast.success("Issue added to the module.");
      router.refresh();
    });
  }

  function detach(issueId: string) {
    startTransition(async () => {
      const result = await removeIssueFromModule({ moduleId, issueId });
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
                <DialogTitle>Add issues to this module</DialogTitle>
              </DialogHeader>
              <Input
                autoFocus
                value={query}
                placeholder="Search this project's issues…"
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="max-h-80 overflow-y-auto">
                {candidates.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-text-400">
                    {pending ? "Searching…" : "No matching issues."}
                  </p>
                ) : (
                  candidates.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      disabled={attached.has(candidate.id) || pending}
                      onClick={() => attach(candidate.id)}
                      className="flex h-row w-full items-center gap-2 rounded-sm px-1 text-left transition-colors duration-[120ms] ease-out hover:bg-bg-80 disabled:opacity-50"
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
                      {attached.has(candidate.id) && (
                        <span className="text-2xs text-text-400">Added</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {issues.length === 0 ? (
        <p className="mt-2 rounded-md border border-border-subtle px-3 py-6 text-center text-xs text-text-400">
          No issues in this module yet.
        </p>
      ) : (
        <ul className="mt-2 overflow-hidden rounded-md border border-border-subtle">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className="flex h-row items-center gap-2 border-b border-border-subtle px-3 last:border-b-0 hover:bg-bg-80/50"
            >
              <StateIcon
                group={issue.stateGroup as StateGroup}
                color={issue.stateColor}
                size={14}
              />
              <IssueIdBadge
                identifier={issue.identifier.replace(/-\d+$/, "")}
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
                  aria-label={`Remove ${issue.name} from this module`}
                  disabled={pending}
                  onClick={() => detach(issue.id)}
                  className="rounded-sm p-1 text-text-400 transition-colors duration-[120ms] ease-out hover:bg-bg-80 hover:text-text-100"
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
