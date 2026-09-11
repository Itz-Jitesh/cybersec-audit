"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { MoreHorizontal, SmilePlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { deleteComment, toggleReaction } from "@/actions/comments";
import { MemberAvatar } from "@/components/shared/member-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CommentRow } from "@/db/queries/issues";
import { cn } from "@/lib/utils";
import { sanitizeRichText } from "@/lib/utils/sanitize-html-client";

const REACTIONS = ["👍", "🎉", "🚀", "👀", "😄", "😕", "❤️"] as const;

function reactionLabel(names: string[], currentUserId: string, userIds: string[]): string {
  const mine = userIds.includes(currentUserId);
  const others = names.filter((_, i) => userIds[i] !== currentUserId);

  if (names.length === 1) {
    return mine ? "You reacted" : `${names[0]} reacted`;
  }
  if (others.length === 0) {
    return "You and others reacted";
  }
  if (mine) {
    return others.length === 1
      ? `You and ${others[0]} reacted`
      : `You, ${others[0]} and ${others.length - 1} more reacted`;
  }
  return names.length <= 3
    ? names.join(", ") + " reacted"
    : `${names[0]}, ${names[1]} and ${names.length - 2} more reacted`;
}

export function CommentItem({
  comment,
  currentUserId,
  canModerate,
  onChanged,
}: {
  comment: CommentRow;
  currentUserId: string;
  canModerate: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isAuthor = comment.authorId === currentUserId;

  async function react(emoji: string) {
    setBusy(true);
    const result = await toggleReaction({ commentId: comment.id, emoji });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    onChanged();
  }

  return (
    <li className="flex gap-2.5 py-3">
      <MemberAvatar
        user={{
          id: comment.authorId,
          displayName: comment.authorName,
          avatarUrl: comment.authorAvatar,
        }}
        size={24}
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-100">
            {comment.authorName}
          </span>
          <span className="text-xs text-text-400">
            {formatDistanceToNowStrict(new Date(comment.createdAt), { addSuffix: true })}
            {comment.isEdited && " · edited"}
          </span>

          <span className="flex-1" />

          {(isAuthor || canModerate) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Comment actions"
                  className="flex size-10 items-center justify-center rounded-sm text-text-400 hover:bg-bg-70 hover:text-text-100 sm:size-7"
                >
                  <MoreHorizontal size={14} strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end" className="w-40">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={async () => {
                    const result = await deleteComment({
                      commentId: comment.id,
                    });
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    onChanged();
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div
          className="mt-1 text-sm text-text-200 [&_.mention]:text-brand [&_a]:text-brand [&_a]:underline [&_p]:my-1"
          dangerouslySetInnerHTML={{
            __html: sanitizeRichText(comment.contentHtml),
          }}
        />

        <TooltipProvider delayDuration={300}>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {comment.reactions.map((reaction) => {
              const mine = reaction.userIds.includes(currentUserId);
              return (
                <Tooltip key={reaction.emoji}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => react(reaction.emoji)}
                      title={mine ? "Click to remove" : undefined}
                      className={cn(
                        "flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs transition-colors duration-[120ms] ease-out",
                        mine
                          ? "border-brand bg-brand-subtle text-text-100 hover:border-danger hover:bg-danger/10"
                          : "border-border-subtle text-text-300 hover:bg-bg-80",
                      )}
                    >
                      <span aria-hidden>{reaction.emoji}</span>
                      {reaction.userIds.length}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {reactionLabel(reaction.names, currentUserId, reaction.userIds)}
                    {mine && (
                      <span className="ml-1 text-text-400">· click to remove</span>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Add reaction"
                  className="flex size-10 items-center justify-center rounded-full text-text-400 hover:bg-bg-80 hover:text-text-200 sm:size-6"
                >
                  <SmilePlus size={14} strokeWidth={1.5} />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="flex w-auto gap-1 p-1.5">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => react(emoji)}
                    className="flex size-10 items-center justify-center rounded-sm text-base hover:bg-bg-70 sm:size-8"
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </TooltipProvider>
      </div>
    </li>
  );
}
