"use client";

import { formatDistanceToNow } from "date-fns";
import { FileText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createPage, deletePage } from "@/actions/pages";
import { MemberAvatar } from "@/components/shared/member-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PageRow } from "@/db/queries/pages";

/** Page list with create and delete. Rows open the editor. */
export function PagesList({
  projectId,
  pages,
  currentUserId,
  canModerate,
}: {
  projectId: string;
  pages: PageRow[];
  currentUserId: string;
  canModerate: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [pending, startTransition] = useTransition();

  function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createPage({
        projectId,
        title,
        access: isPublic ? "public" : "private",
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not create that page.");
        return;
      }
      setOpen(false);
      setTitle("");
      router.push(`/projects/${projectId}/pages/${result.data.id}`);
    });
  }

  function onDelete(pageId: string) {
    startTransition(async () => {
      const result = await deletePage({ pageId });
      if (!result.ok) {
        toast.error(result.error ?? "Could not delete that page.");
        return;
      }
      toast.success("Page deleted.");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-medium text-text-100">Pages</h1>
          <p className="mt-0.5 text-xs text-text-400">
            Notes and documents that belong to this project.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">New page</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New page</DialogTitle>
            </DialogHeader>
            <form onSubmit={onCreate} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="page-title">Title</Label>
                <Input
                  id="page-title"
                  autoFocus
                  required
                  maxLength={200}
                  value={title}
                  placeholder="Meeting notes"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-text-300">
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                Visible to everyone on the project
              </label>
              <DialogFooter>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? "Creating…" : "Create page"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {pages.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-md border border-border-subtle px-3 py-10 text-center">
          <FileText size={20} strokeWidth={1.5} className="text-text-400" />
          <p className="text-xs text-text-300">No pages yet.</p>
        </div>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-md border border-border-subtle">
          {pages.map((page) => (
            <li
              key={page.id}
              className="flex h-11 items-center gap-3 border-b border-border-subtle px-3 last:border-b-0 hover:bg-bg-80/50"
            >
              <Link
                href={`/projects/${projectId}/pages/${page.id}`}
                className="min-w-0 flex-1 truncate text-xs text-text-100"
              >
                {page.title}
              </Link>
              <span className="rounded-full bg-bg-80 px-1.5 py-0.5 text-2xs text-text-300 capitalize">
                {page.access}
              </span>
              <MemberAvatar
                user={{
                  id: page.ownerId,
                  displayName: page.ownerName,
                  avatarUrl: page.ownerAvatarUrl,
                }}
                size={16}
              />
              <span className="w-28 shrink-0 text-right text-2xs text-text-400">
                {formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}
              </span>
              {(page.ownerId === currentUserId || canModerate) && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => onDelete(page.id)}
                >
                  Delete
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
