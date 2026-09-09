"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createModule } from "@/actions/modules";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MemberRow } from "@/db/queries/project";
import type { ModuleStatus } from "@/lib/validators/module";

const NO_LEAD = "none";

/**
 * New-module dialog. Unlike cycles there is no overlap rule — modules group
 * work across cycles, so two may cover the same dates.
 */
export function CreateModuleDialog({
  projectId,
  members,
}: {
  projectId: string;
  members: MemberRow[];
}) {
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState(NO_LEAD);
  const [status, setStatus] = useState<ModuleStatus>("planned");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createModule({
        projectId,
        name: String(form.get("name") ?? ""),
        description: String(form.get("description") ?? ""),
        leadId: leadId === NO_LEAD ? null : leadId,
        status,
        startDate: String(form.get("startDate") ?? "") || null,
        targetDate: String(form.get("targetDate") ?? "") || null,
      });
      if (!result.ok) {
        toast.error(result.error ?? "That did not work.");
        return;
      }
      toast.success("Module created.");
      setOpen(false);
      router.push(`/projects/${projectId}/modules/${result.data.id}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New module</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New module</DialogTitle>
          <DialogDescription>
            A body of work that can span several cycles.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="module-name">Name</Label>
            <Input
              id="module-name"
              name="name"
              placeholder="Authentication"
              required
              maxLength={120}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="module-lead">Lead</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger id="module-lead">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_LEAD}>No lead</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="module-status">Status</Label>
              <Select
                value={status}
                onValueChange={(next) => setStatus(next as ModuleStatus)}
              >
                <SelectTrigger id="module-status">
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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="module-start">Start date</Label>
              <Input id="module-start" name="startDate" type="date" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="module-target">Target date</Label>
              <Input id="module-target" name="targetDate" type="date" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="module-description">Description (optional)</Label>
            <Textarea
              id="module-description"
              name="description"
              rows={3}
              maxLength={2000}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create module"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
