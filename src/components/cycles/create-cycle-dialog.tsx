"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createCycle } from "@/actions/cycles";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** New-cycle dialog. Dates drive the server-computed status; overlap is rejected there. */
export function CreateCycleDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createCycle({
        projectId,
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
        startDate: String(form.get("startDate") ?? ""),
        endDate: String(form.get("endDate") ?? ""),
      });
      if (!result.ok) {
        toast.error(result.error ?? "That did not work.");
        return;
      }
      toast.success("Cycle created.");
      setOpen(false);
      router.push(`/projects/${projectId}/cycles/${result.data.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          New cycle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New cycle</DialogTitle>
          <DialogDescription>
            Only one live cycle at a time — overlapping dates are rejected.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="cycle-name">Name</Label>
            <Input
              id="cycle-name"
              name="name"
              placeholder="Sprint 4"
              required
              maxLength={120}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cycle-start">Start date</Label>
              <Input id="cycle-start" name="startDate" type="date" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cycle-end">End date</Label>
              <Input id="cycle-end" name="endDate" type="date" required />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cycle-description">Description (optional)</Label>
            <Textarea
              id="cycle-description"
              name="description"
              rows={3}
              maxLength={2000}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create cycle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
