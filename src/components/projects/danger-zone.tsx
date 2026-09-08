"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { archiveProject, deleteProject } from "@/actions/projects";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Archiving is reversible and deletion is not, so only deletion demands the
 * typed confirmation — and the action re-checks that string server-side, since
 * a dialog is a courtesy and not a control.
 */
export function DangerZone({
  projectId,
  projectName,
  canDelete,
}: {
  projectId: string;
  projectName: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-lg border border-danger/40">
      <div className="flex items-center justify-between gap-4 border-b border-border-subtle px-4 py-3">
        <div>
          <p className="text-sm font-medium text-text-100">Archive project</p>
          <p className="mt-0.5 text-xs text-text-300">
            Hides it from the sidebar and every list. Nothing is deleted, and it
            can be restored.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const result = await archiveProject({ projectId });
            setBusy(false);
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success(`${projectName} archived.`);
            router.push("/home");
            router.refresh();
          }}
        >
          Archive
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-text-100">Delete project</p>
          <p className="mt-0.5 text-xs text-text-300">
            Permanently removes the project and every issue, cycle and comment
            in it. This cannot be undone.
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="destructive" disabled={!canDelete}>
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {projectName}?</AlertDialogTitle>
              <AlertDialogDescription>
                Every issue, cycle, module, page and comment in this project is
                deleted with it. There is no undo and no backup you can restore
                from.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div>
              <p className="text-xs text-text-300">
                Type{" "}
                <span className="font-medium text-text-100">{projectName}</span>{" "}
                to confirm.
              </p>
              <Input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1.5"
                aria-label="Project name confirmation"
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmation("")}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmation !== projectName || busy}
                onClick={async () => {
                  setBusy(true);
                  const result = await deleteProject({
                    projectId,
                    confirmation,
                  });
                  setBusy(false);
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(`${projectName} deleted.`);
                  router.push("/home");
                  router.refresh();
                }}
              >
                Delete permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
