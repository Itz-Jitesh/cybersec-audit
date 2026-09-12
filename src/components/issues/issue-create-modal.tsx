"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";

import { createIssueAppeal } from "@/actions/appeals";
import { createIssue } from "@/actions/issues";
import type { EditorValue } from "@/components/editor/rich-editor";
import type { StateOption } from "@/components/issues/issue-row-dropdowns";
import { MemberAvatar } from "@/components/shared/member-avatar";
import {
  type IssuePriority,
  PriorityIcon,
} from "@/components/shared/priority-icon";
import { StateIcon } from "@/components/shared/state-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { IssueLabelRef } from "@/db/queries/issues";
import type { MemberRow } from "@/db/queries/project";

const PRIORITIES: IssuePriority[] = ["urgent", "high", "medium", "low", "none"];

/** Same reason as the peek overlay: the editor is dead weight until this opens. */
const RichEditor = dynamic(
  () => import("@/components/editor/rich-editor").then((m) => m.RichEditor),
  { ssr: false },
);

interface IssueCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  states: StateOption[];
  members: MemberRow[];
  labels: IssueLabelRef[];
  cycles: { id: string; name: string }[];
  modules: { id: string; name: string }[];
  defaultStateId?: string;
  /**
   * False for everyone who cannot open an issue outright — leads, members and
   * mentors. The modal then raises a create appeal instead, and the fields a
   * lead decides (state, assignees, labels, cycle, dates) are hidden, because
   * offering them would imply they survive the request, and they do not.
   */
  canCreateDirect?: boolean;
  onCreated: () => void;
}

function Chip({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="flex h-7 items-center gap-1.5 rounded-md border border-border-subtle px-2 text-xs text-text-200 transition-colors duration-[120ms] ease-out hover:bg-bg-80"
    >
      {children}
    </button>
  );
}

export function IssueCreateModal({
  open,
  onOpenChange,
  projectId,
  states,
  members,
  labels,
  cycles,
  modules,
  defaultStateId,
  canCreateDirect = true,
  onCreated,
}: IssueCreateModalProps) {
  const fallbackState =
    defaultStateId ?? states.find((state) => state.id)?.id ?? "";

  const [name, setName] = useState("");
  const [description, setDescription] = useState<EditorValue | null>(null);
  const [stateId, setStateId] = useState(fallbackState);
  const [priority, setPriority] = useState<IssuePriority>("none");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [estimate, setEstimate] = useState("");
  const [createMore, setCreateMore] = useState(false);
  const [saving, setSaving] = useState(false);
  /** Remounts the editor so a kept-open modal starts with an empty body. */
  const [editorKey, setEditorKey] = useState(0);

  const state = states.find((candidate) => candidate.id === stateId);

  function toggle(list: string[], id: string): string[] {
    return list.includes(id)
      ? list.filter((item) => item !== id)
      : [...list, id];
  }

  async function submit() {
    if (name.trim().length === 0) return;
    setSaving(true);

    if (!canCreateDirect) {
      const appeal = await createIssueAppeal({
        projectId,
        title: name.trim(),
        descriptionHtml: description?.html,
        descriptionJson: description?.json,
        proposedPriority: priority,
      });

      setSaving(false);

      if (!appeal.ok) {
        toast.error(appeal.error);
        return;
      }

      toast.success("Sent to the team lead for approval.");
      onCreated();
      setName("");
      setDescription(null);
      setEditorKey((key) => key + 1);
      if (!createMore) onOpenChange(false);
      return;
    }

    const result = await createIssue({
      projectId,
      name: name.trim(),
      descriptionHtml: description?.html,
      descriptionJson: description?.json,
      stateId: stateId || undefined,
      priority,
      assigneeIds,
      labelIds,
      moduleIds,
      cycleId,
      startDate: startDate || null,
      targetDate: targetDate || null,
      estimatePoint: estimate === "" ? null : Number(estimate),
    });

    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Issue created.");
    onCreated();

    // "Create more" resets only the title and body, so the state, assignees and
    // labels chosen for this batch carry to the next one.
    setName("");
    setDescription(null);
    setEditorKey((key) => key + 1);

    if (!createMore) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {canCreateDirect ? "New issue" : "Request an issue"}
          </DialogTitle>
        </DialogHeader>

        <Input
          autoFocus
          value={name}
          placeholder="Issue title"
          onChange={(event) => setName(event.target.value)}
          className="border-0 px-0 text-base shadow-none focus-visible:ring-0"
        />

        <div className="max-h-[240px] overflow-y-auto">
          <RichEditor
            key={editorKey}
            members={members}
            placeholder="Add a description…"
            onChange={setDescription}
          />
        </div>

        {/* The fields a lead decides are not shown on a request. */}
        {canCreateDirect && (
          <div className="flex flex-wrap gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Chip>
                  {state ? (
                    <>
                      <StateIcon
                        group={state.group}
                        color={state.color}
                        size={12}
                      />
                      {state.name}
                    </>
                  ) : (
                    "State"
                  )}
                </Chip>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="start" className="w-48">
                {states.map((option) => (
                  <DropdownMenuItem
                    key={option.id}
                    onSelect={() => setStateId(option.id)}
                    className="gap-2"
                  >
                    <StateIcon
                      group={option.group}
                      color={option.color}
                      size={14}
                    />
                    {option.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Chip>
                  <PriorityIcon priority={priority} size={14} />
                  <span className="capitalize">{priority}</span>
                </Chip>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="start" className="w-40">
                {PRIORITIES.map((option) => (
                  <DropdownMenuItem
                    key={option}
                    onSelect={() => setPriority(option)}
                    className="gap-2 capitalize"
                  >
                    <PriorityIcon priority={option} size={14} />
                    {option}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Chip>
                  {assigneeIds.length === 0
                    ? "Assignees"
                    : `${assigneeIds.length} assigned`}
                </Chip>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="start"
                className="max-h-72 w-56 overflow-y-auto"
              >
                {members.map((member) => (
                  <DropdownMenuCheckboxItem
                    key={member.userId}
                    checked={assigneeIds.includes(member.userId)}
                    onSelect={(event) => {
                      event.preventDefault();
                      setAssigneeIds((current) =>
                        toggle(current, member.userId),
                      );
                    }}
                    className="gap-2"
                  >
                    <MemberAvatar
                      user={{
                        id: member.userId,
                        displayName: member.displayName,
                        avatarUrl: member.avatarUrl,
                      }}
                      size={16}
                    />
                    {member.displayName}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Chip>
                  {labelIds.length === 0
                    ? "Labels"
                    : `${labelIds.length} labels`}
                </Chip>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="start"
                className="max-h-72 w-56 overflow-y-auto"
              >
                {labels.map((label) => (
                  <DropdownMenuCheckboxItem
                    key={label.id}
                    checked={labelIds.includes(label.id)}
                    onSelect={(event) => {
                      event.preventDefault();
                      setLabelIds((current) => toggle(current, label.id));
                    }}
                    className="gap-2"
                  >
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    {label.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {cycles.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Chip>
                    {cycles.find((cycle) => cycle.id === cycleId)?.name ??
                      "Cycle"}
                  </Chip>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="bottom"
                  align="start"
                  className="w-48"
                >
                  <DropdownMenuItem onSelect={() => setCycleId(null)}>
                    No cycle
                  </DropdownMenuItem>
                  {cycles.map((cycle) => (
                    <DropdownMenuItem
                      key={cycle.id}
                      onSelect={() => setCycleId(cycle.id)}
                    >
                      {cycle.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {modules.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Chip>
                    {moduleIds.length === 0
                      ? "Modules"
                      : `${moduleIds.length} modules`}
                  </Chip>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="bottom"
                  align="start"
                  className="w-56"
                >
                  {modules.map((module) => (
                    <DropdownMenuCheckboxItem
                      key={module.id}
                      checked={moduleIds.includes(module.id)}
                      onSelect={(event) => {
                        event.preventDefault();
                        setModuleIds((current) => toggle(current, module.id));
                      }}
                    >
                      {module.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        {canCreateDirect && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="startDate" className="text-xs">
                Start date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="targetDate" className="text-xs">
                Target date
              </Label>
              <Input
                id="targetDate"
                type="date"
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="estimate" className="text-xs">
                Estimate
              </Label>
              <Input
                id="estimate"
                type="number"
                min={0}
                max={21}
                value={estimate}
                onChange={(event) => setEstimate(event.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <label className="flex items-center gap-2 text-xs text-text-300">
            <Switch checked={createMore} onCheckedChange={setCreateMore} />
            {canCreateDirect ? "Create more" : "Request more"}
          </label>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={saving || name.trim().length === 0}
              onClick={submit}
            >
              {saving
                ? canCreateDirect
                  ? "Creating…"
                  : "Sending…"
                : canCreateDirect
                  ? "Create issue"
                  : "Send request"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
