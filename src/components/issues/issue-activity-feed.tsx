"use client";

import { formatDistanceToNowStrict } from "date-fns";

import { MemberAvatar } from "@/components/shared/member-avatar";
import type { ActivityRow } from "@/db/queries/issues";

/** Turns a row into the sentence docs/06-UX-LAYOUT-SPEC.md §8 asks for. */
function describe(entry: ActivityRow): React.ReactNode {
  const from = entry.oldDisplay;
  const to = entry.newDisplay;

  switch (entry.field) {
    case "created":
      return <>created this issue</>;
    case "name":
      return (
        <>
          renamed it to <Value>{to}</Value>
        </>
      );
    case "description":
      return <>updated the description</>;
    case "state":
      return (
        <>
          changed state from <Value>{from}</Value> to <Value>{to}</Value>
        </>
      );
    case "priority":
      return (
        <>
          set priority to <Value>{to}</Value>
        </>
      );
    case "assignee":
      return to ? (
        <>
          assigned <Value>{to}</Value>
        </>
      ) : (
        <>
          unassigned <Value>{from}</Value>
        </>
      );
    case "label":
      return to ? (
        <>
          added the label <Value>{to}</Value>
        </>
      ) : (
        <>
          removed the label <Value>{from}</Value>
        </>
      );
    case "cycle":
      return to ? (
        <>
          added it to <Value>{to}</Value>
        </>
      ) : (
        <>
          removed it from <Value>{from}</Value>
        </>
      );
    case "parent":
      return to ? (
        <>
          made it a sub-issue of <Value>{to}</Value>
        </>
      ) : (
        <>removed its parent</>
      );
    case "target_date":
      return to ? (
        <>
          set the target date to <Value>{to}</Value>
        </>
      ) : (
        <>cleared the target date</>
      );
    case "start_date":
      return to ? (
        <>
          set the start date to <Value>{to}</Value>
        </>
      ) : (
        <>cleared the start date</>
      );
    case "estimate":
      return to ? (
        <>
          estimated it at <Value>{to}</Value>
        </>
      ) : (
        <>cleared the estimate</>
      );
    default:
      return <>updated {entry.field}</>;
  }
}

function Value({ children }: { children: React.ReactNode }) {
  return <span className="text-text-100">{children}</span>;
}

/**
 * Consecutive entries by the same actor within five minutes share one avatar
 * and one name, because a single edit that touched four fields writes four rows
 * and repeating the name four times reads like four people.
 */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function IssueActivityFeed({ entries }: { entries: ActivityRow[] }) {
  if (entries.length === 0) {
    return (
      <p className="py-4 text-xs text-text-400">No activity recorded yet.</p>
    );
  }

  return (
    <ol className="flex flex-col">
      {entries.map((entry, index) => {
        const createdAt = new Date(entry.createdAt);
        const previous = entries[index - 1];
        const prevCreatedAt = previous ? new Date(previous.createdAt) : null;
        const grouped =
          previous !== undefined &&
          prevCreatedAt !== null &&
          previous.actorId === entry.actorId &&
          createdAt.getTime() - prevCreatedAt.getTime() < GROUP_WINDOW_MS;

        return (
          <li key={entry.id} className="flex min-h-6 items-center gap-2">
            <span className="w-5 shrink-0">
              {!grouped && (
                <MemberAvatar
                  user={{
                    id: entry.actorId,
                    displayName: entry.actorName,
                    avatarUrl: entry.actorAvatar,
                  }}
                  size={16}
                />
              )}
            </span>

            <p className="min-w-0 flex-1 truncate text-xs text-text-300">
              {!grouped && (
                <span className="font-medium text-text-100">
                  {entry.actorName}{" "}
                </span>
              )}
              {describe(entry)}
              <span className="text-text-400">
                {" · "}
                {formatDistanceToNowStrict(createdAt, {
                  addSuffix: true,
                })}
              </span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
