import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";

import { MemberAvatar } from "@/components/shared/member-avatar";
import type { ActivityFeedRow } from "@/db/queries/home";

/**
 * The home page's activity feed.
 *
 * Deliberately terser than the per-issue feed in IssueActivityFeed: this one
 * spans every project the reader can see, so each line has to name its issue,
 * which leaves less room for the change itself. The wording of each change
 * matches that component so the same event does not read two different ways in
 * two places.
 */
function describe(entry: ActivityFeedRow): string {
  const from = entry.oldDisplay;
  const to = entry.newDisplay;

  switch (entry.field) {
    case "created":
      return "created";
    case "name":
      return "renamed";
    case "description":
      return "updated the description of";
    case "state":
      return to ? `moved to ${to}:` : "changed the state of";
    case "priority":
      return to ? `set priority ${to} on` : "changed the priority of";
    case "assignee":
      return to ? `assigned ${to} to` : `unassigned ${from} from`;
    case "label":
      return to ? `labelled ${to} on` : `removed the label ${from} from`;
    case "cycle":
      return to ? `added to ${to}:` : `removed from ${from}:`;
    case "parent":
      return to ? `made a sub-issue of ${to}:` : "detached";
    case "estimate":
      return to ? `estimated ${to} on` : "cleared the estimate on";
    case "start_date":
    case "target_date":
      return to ? `dated ${to}:` : "cleared a date on";
    default:
      return "updated";
  }
}

export function RecentActivity({ entries }: { entries: ActivityFeedRow[] }) {
  if (entries.length === 0) {
    return (
      <p className="px-4 py-4 text-xs text-text-300">
        Nothing yet. Every change to an issue — its state, who is on it, the
        cycle it belongs to — shows up here as it happens.
      </p>
    );
  }

  return (
    <ul className="p-2">
      {entries.map((entry) => (
        <li key={entry.id}>
          <Link
            href={`/projects/${entry.projectId}/issues/${entry.issueId}`}
            className="flex items-start gap-2.5 rounded-sm px-2 py-1.5 transition-colors duration-[120ms] ease-out hover:bg-bg-80"
          >
            <MemberAvatar
              user={{
                id: entry.actorId,
                displayName: entry.actorName,
                avatarUrl: entry.actorAvatarUrl,
              }}
              size={20}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-text-300">
                <span className="text-text-100">{entry.actorName}</span>{" "}
                {describe(entry)}{" "}
                <span className="text-text-200">{entry.issueName}</span>
              </span>
              <span className="mt-0.5 block text-2xs text-text-400">
                <span className="font-mono">
                  {entry.identifier}-{entry.sequenceId}
                </span>{" "}
                ·{" "}
                {formatDistanceToNowStrict(new Date(entry.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
