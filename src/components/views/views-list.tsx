"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Bookmark, Copy, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteView, duplicateView, updateView } from "@/actions/views";
import { EmptyState } from "@/components/shared/empty-state";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { ViewRow } from "@/db/queries/views";
import { cn } from "@/lib/utils";
import { useProjectViewStore } from "@/stores/project-view-store";

interface ViewsListProps {
  projectId: string;
  views: ViewRow[];
  currentUserId: string;
}

/** A one-line summary of what a saved view filters on. */
function summarise(view: ViewRow): string[] {
  const parts: string[] = [];
  const counts: [string, number | undefined][] = [
    ["state", view.filters.stateIds?.length],
    ["priority", view.filters.priorities?.length],
    ["assignee", view.filters.assigneeIds?.length],
    ["label", view.filters.labelIds?.length],
    ["cycle", view.filters.cycleIds?.length],
    ["module", view.filters.moduleIds?.length],
  ];

  for (const [name, count] of counts) {
    if (count) parts.push(`${count} ${name}${count > 1 ? "s" : ""}`);
  }
  if (view.filters.search) parts.push(`“${view.filters.search}”`);
  if (parts.length === 0) parts.push("No filters");

  return parts;
}

function ViewRowItem({
  view,
  projectId,
  currentUserId,
  onChanged,
}: {
  view: ViewRow;
  projectId: string;
  currentUserId: string;
  onChanged: () => void;
}) {
  const router = useRouter();
  const applyView = useProjectViewStore((store) => store.applyView);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(view.name);
  const [pending, startTransition] = useTransition();

  const isOwner = view.ownerId === currentUserId;

  /**
   * Applying a view writes it into the same per-project store the issue screen
   * reads, then navigates there. There is no second code path for "viewing a
   * view" — a view is the working state, named.
   */
  function apply() {
    applyView(projectId, {
      layout: view.layout,
      filters: view.filters,
      displayProps: view.displayProps,
    });
    router.push(`/projects/${projectId}/issues`);
  }

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    message: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "That did not work.");
        return;
      }
      toast.success(message);
      onChanged();
    });
  }

  return (
    <div className="flex h-12 items-center gap-3 border-b border-border-subtle px-4 hover:bg-bg-90">
      <Bookmark
        size={14}
        strokeWidth={1.5}
        className="shrink-0 text-text-400"
      />

      {renaming ? (
        <Input
          autoFocus
          value={name}
          disabled={pending}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => setRenaming(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setName(view.name);
              setRenaming(false);
            }
            if (event.key === "Enter" && name.trim()) {
              setRenaming(false);
              run(
                () => updateView({ viewId: view.id, name: name.trim() }),
                "View renamed.",
              );
            }
          }}
          className="h-7 max-w-60 text-xs"
        />
      ) : (
        <button
          type="button"
          onClick={apply}
          className="min-w-0 truncate text-left text-sm text-text-100 hover:text-brand"
        >
          {view.name}
        </button>
      )}

      <span
        className={cn(
          "shrink-0 rounded-full border px-1.5 text-2xs capitalize",
          view.access === "public"
            ? "border-brand text-brand"
            : "border-border-subtle text-text-400",
        )}
      >
        {view.access}
      </span>

      <span className="hidden shrink-0 rounded-md bg-bg-80 px-1.5 text-2xs text-text-300 capitalize sm:inline">
        {view.layout}
      </span>

      <div className="hidden min-w-0 flex-1 items-center gap-1 lg:flex">
        {summarise(view).map((part) => (
          <span
            key={part}
            className="shrink-0 rounded-md border border-border-subtle px-1.5 text-2xs text-text-400"
          >
            {part}
          </span>
        ))}
      </div>

      <span className="flex-1 lg:hidden" />

      <span className="shrink-0 text-2xs text-text-400">
        {formatDistanceToNowStrict(view.updatedAt, { addSuffix: true })}
      </span>

      <MemberAvatar
        user={{
          id: view.ownerId,
          displayName: view.ownerName,
          avatarUrl: view.ownerAvatarUrl,
        }}
        size={20}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${view.name}`}
            className="shrink-0 rounded-sm px-1 text-text-400 hover:bg-bg-70 hover:text-text-100"
          >
            ⋯
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" className="w-44">
          <DropdownMenuItem
            onSelect={() =>
              run(
                () =>
                  duplicateView({
                    viewId: view.id,
                    name: `${view.name} copy`,
                  }),
                "View duplicated.",
              )
            }
          >
            <Copy size={14} strokeWidth={1.5} />
            Duplicate
          </DropdownMenuItem>

          {isOwner && (
            <>
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                <Pencil size={14} strokeWidth={1.5} />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  run(
                    () =>
                      updateView({
                        viewId: view.id,
                        access:
                          view.access === "private" ? "public" : "private",
                      }),
                    view.access === "private"
                      ? "View shared with the project."
                      : "View made private.",
                  )
                }
              >
                <Bookmark size={14} strokeWidth={1.5} />
                Make {view.access === "private" ? "public" : "private"}
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() =>
              run(() => deleteView({ viewId: view.id }), "View deleted.")
            }
          >
            <Trash2 size={14} strokeWidth={1.5} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ViewsList({ projectId, views, currentUserId }: ViewsListProps) {
  const router = useRouter();

  if (views.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No saved views"
        description="Set up filters on the issues screen, then use Save view to keep them."
        action={
          <Button
            size="sm"
            onClick={() => router.push(`/projects/${projectId}/issues`)}
          >
            Go to issues
          </Button>
        }
      />
    );
  }

  return (
    <div>
      {views.map((view) => (
        <ViewRowItem
          key={view.id}
          view={view}
          projectId={projectId}
          currentUserId={currentUserId}
          onChanged={() => router.refresh()}
        />
      ))}
    </div>
  );
}
