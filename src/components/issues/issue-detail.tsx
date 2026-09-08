"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { Link2, Paperclip, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addLink,
  removeLink,
  setAssignees,
  setLabels,
  toggleSubscription,
  updateIssue,
} from "@/actions/issues";
import { RichEditor } from "@/components/editor/rich-editor";
import { CommentEditor } from "@/components/issues/comment-editor";
import { CommentItem } from "@/components/issues/comment-item";
import { IssueActivityFeed } from "@/components/issues/issue-activity-feed";
import {
  AssigneeDropdown,
  LabelDropdown,
  PriorityDropdown,
  StateDropdown,
  type StateOption,
} from "@/components/issues/issue-row-dropdowns";
import { AvatarGroup } from "@/components/shared/avatar-group";
import { InlineEditableText } from "@/components/shared/inline-editable-text";
import { IssueIdBadge } from "@/components/shared/issue-id-badge";
import { LabelChip } from "@/components/shared/label-chip";
import {
  type IssuePriority,
  PriorityIcon,
} from "@/components/shared/priority-icon";
import { type StateGroup,StateIcon } from "@/components/shared/state-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ActivityRow,
  CommentRow,
  IssueDetail as IssueDetailData,
  IssueLabelRef,
} from "@/db/queries/issues";
import type { MemberRow } from "@/db/queries/project";

export interface IssueDetailBundle {
  issue: IssueDetailData;
  subIssues: {
    id: string;
    sequenceId: number;
    identifier: string;
    projectId: string;
    name: string;
    priority: string;
    stateGroup: string;
    stateColor: string;
  }[];
  links: { id: string; url: string; title: string | null }[];
  attachments: {
    id: string;
    fileName: string;
    fileSize: number;
    uploaderName: string;
  }[];
  comments: CommentRow[];
  activity: ActivityRow[];
}

interface IssueDetailProps extends IssueDetailBundle {
  states: StateOption[];
  members: MemberRow[];
  labels: IssueLabelRef[];
  currentUserId: string;
  canModerate: boolean;
  onChanged: () => void;
}

function Property({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-7 items-center gap-2">
      <span className="text-text-300 w-20 shrink-0 text-xs">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <h3 className="text-text-300 mb-1.5 text-xs font-medium">
        {title}
        {count && <span className="text-text-400"> {count}</span>}
      </h3>
      {children}
    </section>
  );
}

/**
 * One implementation, two mountings: the peek overlay wraps it in a Dialog and
 * the full page renders it directly. Duplicating it would guarantee the two
 * drift, and the peek is where most editing actually happens.
 */
export function IssueDetail({
  issue,
  subIssues,
  links,
  attachments,
  comments,
  activity,
  states,
  members,
  labels,
  currentUserId,
  canModerate,
  onChanged,
}: IssueDetailProps) {
  const [pending, startTransition] = useTransition();
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [subscribed, setSubscribed] = useState(issue.isSubscribed);

  const assigneeIds = issue.assignees.map((assignee) => assignee.id);
  const labelIds = issue.labels.map((label) => label.id);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "That did not work.");
        return;
      }
      onChanged();
    });
  }

  const completedSubs = subIssues.filter(
    (sub) => sub.stateGroup === "completed",
  ).length;

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {/* Main column */}
      <div className="min-w-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="flex items-center gap-2">
          <IssueIdBadge
            identifier={issue.identifier}
            sequenceId={issue.sequenceId}
          />
          {issue.parentName && (
            <span className="text-text-400 truncate text-xs">
              in {issue.parentName}
            </span>
          )}
        </div>

        <h1 className="text-text-100 mt-1.5 text-xl font-semibold">
          <InlineEditableText
            value={issue.name}
            multiline
            onSave={(name) =>
              new Promise<void>((resolve) => {
                run(async () => {
                  const result = await updateIssue({
                    issueId: issue.id,
                    name,
                  });
                  resolve();
                  return result;
                });
              })
            }
          />
        </h1>

        <div className="mt-3">
          <RichEditor
            content={issue.descriptionJson ?? issue.descriptionHtml ?? ""}
            members={members}
            onAutosave={async (value) => {
              const result = await updateIssue({
                issueId: issue.id,
                descriptionHtml: value.html,
                descriptionJson: value.json,
              });
              if (!result.ok) toast.error(result.error);
            }}
          />
        </div>

        {subIssues.length > 0 && (
          <Section
            title="Sub-issues"
            count={`${completedSubs}/${subIssues.length}`}
          >
            <ul className="border-border-subtle overflow-hidden rounded-md border">
              {subIssues.map((sub) => (
                <li key={sub.id}>
                  <Link
                    href={`/projects/${sub.projectId}/issues/${sub.id}`}
                    className="hover:bg-bg-90 border-border-subtle flex h-8 items-center gap-2 border-b px-2.5 last:border-b-0"
                  >
                    <PriorityIcon
                      priority={sub.priority as IssuePriority}
                      size={14}
                    />
                    <StateIcon
                      group={sub.stateGroup as StateGroup}
                      color={sub.stateColor}
                      size={14}
                    />
                    <IssueIdBadge
                      identifier={sub.identifier}
                      sequenceId={sub.sequenceId}
                    />
                    <span className="text-text-200 truncate text-sm">
                      {sub.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Links">
          {links.length > 0 && (
            <ul className="mb-2 flex flex-col gap-1">
              {links.map((link) => (
                <li key={link.id} className="flex items-center gap-2">
                  <Link2 size={14} strokeWidth={1.5} className="text-text-400" />
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-brand min-w-0 flex-1 truncate text-xs underline"
                  >
                    {link.title || link.url}
                  </a>
                  <button
                    type="button"
                    aria-label="Remove link"
                    onClick={() => run(() => removeLink({ linkId: link.id }))}
                    className="text-text-400 hover:text-danger rounded-sm p-1"
                  >
                    <Trash2 size={12} strokeWidth={1.5} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {showLinkInput ? (
            <div className="flex gap-2">
              <Input
                autoFocus
                value={linkUrl}
                placeholder="https://…"
                onChange={(event) => setLinkUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setShowLinkInput(false);
                    setLinkUrl("");
                  }
                }}
              />
              <Button
                size="sm"
                disabled={pending || linkUrl.length === 0}
                onClick={() =>
                  run(async () => {
                    const result = await addLink({
                      issueId: issue.id,
                      url: linkUrl,
                    });
                    if (result.ok) {
                      setLinkUrl("");
                      setShowLinkInput(false);
                    }
                    return result;
                  })
                }
              >
                Add
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              onClick={() => setShowLinkInput(true)}
            >
              <Plus size={14} strokeWidth={1.5} />
              Add link
            </Button>
          )}
        </Section>

        {attachments.length > 0 && (
          <Section title="Attachments">
            <ul className="flex flex-col gap-1">
              {attachments.map((file) => (
                <li
                  key={file.id}
                  className="text-text-300 flex items-center gap-2 text-xs"
                >
                  <Paperclip size={14} strokeWidth={1.5} />
                  <span className="text-text-200 truncate">{file.fileName}</span>
                  <span className="text-text-400">
                    {Math.max(1, Math.round(file.fileSize / 1024))} KB
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="mt-6">
          <Tabs defaultValue="comments">
            <TabsList>
              <TabsTrigger value="comments">
                Comments {comments.length > 0 && `(${comments.length})`}
              </TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="comments" className="mt-3">
              {comments.length > 0 && (
                <ul className="divide-border-subtle divide-y">
                  {comments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      currentUserId={currentUserId}
                      canModerate={canModerate}
                      onChanged={onChanged}
                    />
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <CommentEditor
                  issueId={issue.id}
                  members={members}
                  onPosted={onChanged}
                />
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-3">
              <IssueActivityFeed entries={activity} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right sidebar */}
      <aside className="border-border-subtle w-full shrink-0 overflow-y-auto border-t px-4 py-4 lg:w-detail-panel lg:border-t-0 lg:border-l">
        <Property label="State">
          <StateDropdown
            states={states}
            value={issue.stateId}
            onSelect={(stateId) =>
              run(() => updateIssue({ issueId: issue.id, stateId }))
            }
          >
            <button
              type="button"
              className="hover:bg-bg-80 flex h-7 w-full items-center gap-2 rounded-sm px-1.5 text-sm"
            >
              <StateIcon
                group={issue.stateGroup as StateGroup}
                color={issue.stateColor}
                size={14}
              />
              <span className="text-text-100">{issue.stateName}</span>
            </button>
          </StateDropdown>
        </Property>

        <Property label="Priority">
          <PriorityDropdown
            value={issue.priority as IssuePriority}
            onSelect={(priority) =>
              run(() => updateIssue({ issueId: issue.id, priority }))
            }
          >
            <button
              type="button"
              className="hover:bg-bg-80 flex h-7 w-full items-center gap-2 rounded-sm px-1.5 text-sm capitalize"
            >
              <PriorityIcon
                priority={issue.priority as IssuePriority}
                size={14}
              />
              <span className="text-text-100">{issue.priority}</span>
            </button>
          </PriorityDropdown>
        </Property>

        <Property label="Assignees">
          <AssigneeDropdown
            members={members}
            selected={assigneeIds}
            onToggle={(userId) => {
              const next = assigneeIds.includes(userId)
                ? assigneeIds.filter((id) => id !== userId)
                : [...assigneeIds, userId];
              run(() => setAssignees({ issueId: issue.id, userIds: next }));
            }}
          >
            <button
              type="button"
              className="hover:bg-bg-80 flex h-7 w-full items-center gap-2 rounded-sm px-1.5"
            >
              {issue.assignees.length > 0 ? (
                <AvatarGroup
                  users={issue.assignees.map((assignee) => ({
                    id: assignee.id,
                    displayName: assignee.displayName,
                    avatarUrl: assignee.avatarUrl,
                  }))}
                  max={3}
                  size={20}
                />
              ) : (
                <span className="text-text-400 text-sm">Unassigned</span>
              )}
            </button>
          </AssigneeDropdown>
        </Property>

        <Property label="Labels">
          <LabelDropdown
            labels={labels}
            selected={labelIds}
            onToggle={(labelId) => {
              const next = labelIds.includes(labelId)
                ? labelIds.filter((id) => id !== labelId)
                : [...labelIds, labelId];
              run(() => setLabels({ issueId: issue.id, labelIds: next }));
            }}
          >
            <button
              type="button"
              className="hover:bg-bg-80 flex min-h-7 w-full flex-wrap items-center gap-1 rounded-sm px-1.5 py-1"
            >
              {issue.labels.length > 0 ? (
                issue.labels.map((label) => (
                  <LabelChip key={label.id} label={label} />
                ))
              ) : (
                <span className="text-text-400 text-sm">None</span>
              )}
            </button>
          </LabelDropdown>
        </Property>

        <Property label="Start date">
          <Input
            type="date"
            value={issue.startDate ?? ""}
            onChange={(event) =>
              run(() =>
                updateIssue({
                  issueId: issue.id,
                  startDate: event.target.value || null,
                }),
              )
            }
            className="h-7"
          />
        </Property>

        <Property label="Target date">
          <Input
            type="date"
            value={issue.targetDate ?? ""}
            onChange={(event) =>
              run(() =>
                updateIssue({
                  issueId: issue.id,
                  targetDate: event.target.value || null,
                }),
              )
            }
            className="h-7"
          />
        </Property>

        <Property label="Estimate">
          <Input
            type="number"
            min={0}
            max={21}
            value={issue.estimatePoint ?? ""}
            onChange={(event) =>
              run(() =>
                updateIssue({
                  issueId: issue.id,
                  estimatePoint:
                    event.target.value === "" ? null : Number(event.target.value),
                }),
              )
            }
            className="h-7"
          />
        </Property>

        <div className="border-border-subtle mt-4 border-t pt-3">
          <p className="text-text-400 text-xs">
            Created by {issue.createdByName}{" "}
            {formatDistanceToNowStrict(issue.createdAt, { addSuffix: true })}
          </p>
          <p className="text-text-400 mt-0.5 text-xs">
            Updated{" "}
            {formatDistanceToNowStrict(issue.updatedAt, { addSuffix: true })}
          </p>

          <Button
            size="sm"
            variant="secondary"
            className="mt-3 w-full"
            disabled={pending}
            onClick={async () => {
              const result = await toggleSubscription({ issueId: issue.id });
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setSubscribed(result.data.subscribed);
            }}
          >
            {subscribed ? "Unsubscribe" : "Subscribe"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="mt-1.5 w-full"
            onClick={() => {
              void navigator.clipboard.writeText(
                `${window.location.origin}/projects/${issue.projectId}/issues/${issue.id}`,
              );
              toast.success("Link copied.");
            }}
          >
            Copy link
          </Button>
        </div>
      </aside>
    </div>
  );
}
