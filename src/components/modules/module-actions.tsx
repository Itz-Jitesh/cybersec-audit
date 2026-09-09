"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteModule, updateModule } from "@/actions/modules";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ModuleStatus } from "@/lib/validators/module";

interface ModuleActionsProps {
  moduleId: string;
  projectId: string;
  status: ModuleStatus;
  canManage: boolean;
}

/** Status change and delete. Both are module-manager operations. */
export function ModuleActions({
  moduleId,
  projectId,
  status,
  canManage,
}: ModuleActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canManage) return null;

  function onStatusChange(next: string) {
    startTransition(async () => {
      const result = await updateModule({
        moduleId,
        status: next as ModuleStatus,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not change the status.");
        return;
      }
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteModule({ moduleId });
      if (!result.ok) {
        toast.error(result.error ?? "Could not delete the module.");
        return;
      }
      toast.success("Module deleted.");
      setOpen(false);
      router.push(`/projects/${projectId}/modules`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={status} onValueChange={onStatusChange} disabled={pending}>
        <SelectTrigger size="sm" aria-label="Module status" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="planned">Planned</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="paused">Paused</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="secondary">
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this module?</DialogTitle>
            <DialogDescription>
              The issues in it are not deleted — they simply stop belonging to a
              module. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={onDelete}
            >
              {pending ? "Deleting…" : "Delete module"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
