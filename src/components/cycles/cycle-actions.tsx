"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { completeCycle, deleteCycle } from "@/actions/cycles";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CycleActionsProps {
  cycleId: string;
  projectId: string;
  canManage: boolean;
  isCompleted: boolean;
  incompleteCount: number;
  transferTargets: { id: string; name: string }[];
}

/** Complete-with-transfer and delete. Both are project-manager operations. */
export function CycleActions({
  cycleId,
  projectId,
  canManage,
  isCompleted,
  incompleteCount,
  transferTargets,
}: CycleActionsProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onComplete(destination: string) {
    startTransition(async () => {
      const result = await completeCycle({
        cycleId,
        transferToCycleId: destination === "backlog" ? null : destination,
        moveToBacklog: destination === "backlog",
      });
      if (!result.ok) {
        toast.error(result.error ?? "Could not complete the cycle.");
        return;
      }
      toast.success(
        result.data.moved > 0
          ? `Cycle completed — ${result.data.moved} issue(s) moved.`
          : "Cycle completed.",
      );
      setOpen(false);
      router.refresh();
    });
  }

  function onDelete() {
    startTransition(async () => {
      const result = await deleteCycle({ cycleId });
      if (!result.ok) {
        toast.error(result.error ?? "Could not delete the cycle.");
        return;
      }
      toast.success("Cycle deleted. Its issues are back in the backlog.");
      router.push(`/projects/${projectId}/cycles`);
    });
  }

  if (!canManage) return null;

  if (isCompleted) {
    return (
      <Button variant="ghost" size="sm" onClick={onDelete} disabled={pending}>
        Delete cycle
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Complete cycle</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete this cycle</DialogTitle>
          <DialogDescription>
            {incompleteCount > 0
              ? `${incompleteCount} incomplete issue(s) — choose where they go.`
              : "No incomplete issues left in this cycle."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="transfer-target">Move incomplete issues to</Label>
          <Select onValueChange={onComplete} disabled={pending}>
            <SelectTrigger id="transfer-target" className="w-full">
              <SelectValue placeholder="Choose a destination…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="backlog">Backlog (no cycle)</SelectItem>
              {transferTargets.map((target) => (
                <SelectItem key={target.id} value={target.id}>
                  {target.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={pending}
            className="mr-auto"
          >
            Delete instead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
