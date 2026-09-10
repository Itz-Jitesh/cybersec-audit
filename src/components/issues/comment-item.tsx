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
import type { CommentRow } from "@/db/queries/issues";
import { cn } from "@/lib/utils";
import { sanitizeRichText } from "@/lib/utils/sanitize-html";

/**
 * A fixed set rather than a full emoji picker. These are the reactions a
 * tracker actually collects, and shipping three packages to render a search
 * grid for them would be a poor trade — the prompt's emoji-mart is deliberately
 * not used, and this is noted in BUILDPHASES.md.
 */
const REACTIONS = ["👍", "🎉", "🚀", "👀", "😄", "😕", "❤️"] as const;

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
            {formatDistanceToNowStrict(comment.createdAt, { addSuffix: true })}
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
          // Sanitised again here even though createComment already sanitised on
          // write. Rows stored before that existed are still in the database,
          // and a second pass on a string that is already clean costs nothing.
          dangerouslySetInnerHTML={{
            __html: sanitizeRichText(comment.contentHtml),
          }}
        />

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {comment.reactions.map((reaction) => {
            const mine = reaction.userIds.includes(currentUserId);
            return (
              <button
                key={reaction.emoji}
                type="button"
                disabled={busy}
                onClick={() => react(reaction.emoji)}
                className={cn(
                  "flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs transition-colors duration-[120ms] ease-out",
                  mine
                    ? "border-brand bg-brand-subtle text-text-100"
                    : "border-border-subtle text-text-300 hover:bg-bg-80",
                )}
              >
                <span aria-hidden>{reaction.emoji}</span>
                {reaction.userIds.length}
              </button>
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
      </div>
    </li>
  );
}
