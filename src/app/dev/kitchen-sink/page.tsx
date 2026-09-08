import { CircleDot } from "lucide-react";

import { KitchenSinkInteractive } from "@/app/dev/kitchen-sink/interactive";
import { AvatarGroup } from "@/components/shared/avatar-group";
import { DateChip } from "@/components/shared/date-chip";
import { EmptyState } from "@/components/shared/empty-state";
import { IssueIdBadge } from "@/components/shared/issue-id-badge";
import { Kbd } from "@/components/shared/kbd";
import { MemberAvatar } from "@/components/shared/member-avatar";
import {
  type IssuePriority,
  PriorityIcon,
} from "@/components/shared/priority-icon";
import { ProgressRing } from "@/components/shared/progress-ring";
import { type StateGroup, StateIcon } from "@/components/shared/state-icon";
import { Button } from "@/components/ui/button";
import {
  DEMO_CUSTOM_STATE_COLOR,
  DEMO_USERS,
} from "@/lib/dev/kitchen-sink-fixtures";

/**
 * Development-only reference page. Every shared primitive appears here in every
 * meaningful variant so the whole design system can be checked in one glance.
 * Deleted in phase 12 before production.
 */

const PRIORITIES: IssuePriority[] = ["urgent", "high", "medium", "low", "none"];
const STATE_GROUPS: StateGroup[] = [
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border-subtle py-6">
      <h2 className="mb-4 text-2xs font-medium tracking-wide text-text-400 uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center gap-4 py-1">
      <span className="w-40 shrink-0 text-xs text-text-300">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export default function KitchenSinkPage() {
  const today = new Date();
  const overdue = new Date(today.getFullYear(), today.getMonth() - 1, 4);
  const lastYear = new Date(today.getFullYear() - 1, 10, 12);

  return (
    <main className="mx-auto max-w-[1000px] px-6 pt-4 pb-16">
      <header className="py-6">
        <h1 className="text-2xl font-semibold text-text-100">Kitchen sink</h1>
        <p className="mt-1 text-sm text-text-300">
          Every shared primitive, in every state. Development only — removed in
          phase 12.
        </p>
      </header>

      <Section title="Priority icon">
        {([14, 16, 18] as const).map((size) => (
          <Row key={size} label={`size ${size}`}>
            {PRIORITIES.map((priority) => (
              <span key={priority} className="flex items-center gap-1.5">
                <PriorityIcon priority={priority} size={size} />
                <span className="text-xs text-text-300">{priority}</span>
              </span>
            ))}
          </Row>
        ))}
      </Section>

      <Section title="State icon">
        <Row label="group default">
          {STATE_GROUPS.map((group) => (
            <span key={group} className="flex items-center gap-1.5">
              <StateIcon group={group} />
              <span className="text-xs text-text-300">{group}</span>
            </span>
          ))}
        </Row>
        <Row label="colour override">
          {STATE_GROUPS.map((group) => (
            <StateIcon
              key={group}
              group={group}
              color={DEMO_CUSTOM_STATE_COLOR}
              size={16}
            />
          ))}
        </Row>
        <Row label="size 18">
          {STATE_GROUPS.map((group) => (
            <StateIcon key={group} group={group} size={18} />
          ))}
        </Row>
      </Section>

      <Section title="Member avatar">
        {([16, 20, 24, 28] as const).map((size) => (
          <Row key={size} label={`size ${size}`}>
            {DEMO_USERS.map((user) => (
              <MemberAvatar key={user.id} user={user} size={size} />
            ))}
          </Row>
        ))}
      </Section>

      <Section title="Avatar group">
        <Row label="3 of 6, max 3">
          <AvatarGroup users={DEMO_USERS} max={3} />
        </Row>
        <Row label="max 5, size 24">
          <AvatarGroup users={DEMO_USERS} max={5} size={24} />
        </Row>
        <Row label="no overflow">
          <AvatarGroup users={DEMO_USERS.slice(0, 2)} max={3} size={16} />
        </Row>
      </Section>

      <Section title="Date chip">
        <Row label="target, upcoming">
          <DateChip
            date={new Date(today.getFullYear(), today.getMonth() + 1, 18)}
          />
        </Row>
        <Row label="target, overdue">
          <DateChip date={overdue} />
        </Row>
        <Row label="target, overdue but completed">
          <DateChip date={overdue} isCompleted />
        </Row>
        <Row label="start variant, past">
          <DateChip date={overdue} variant="start" />
        </Row>
        <Row label="previous year">
          <DateChip date={lastYear} variant="start" />
        </Row>
      </Section>

      <Section title="Issue ID badge">
        <Row label="identifiers">
          <IssueIdBadge identifier="CTF" sequenceId={1} />
          <IssueIdBadge identifier="CTF" sequenceId={148} />
          <IssueIdBadge identifier="RND" sequenceId={2049} />
        </Row>
      </Section>

      <Section title="Keyboard chip">
        <Row label="single">
          <Kbd keys={["/"]} />
          <Kbd keys={["?"]} />
        </Row>
        <Row label="combination">
          <Kbd keys={["⌘", "K"]} />
          <Kbd keys={["Ctrl", "Shift", "P"]} />
        </Row>
      </Section>

      <Section title="Progress ring">
        {([20, 32, 48] as const).map((size) => (
          <Row key={size} label={`size ${size}`}>
            <ProgressRing value={0} total={10} size={size} />
            <ProgressRing value={3} total={10} size={size} />
            <ProgressRing value={7} total={10} size={size} />
            <ProgressRing value={10} total={10} size={size} />
            <ProgressRing value={7} total={10} size={size} showLabel />
            <ProgressRing value={0} total={0} size={size} showLabel />
          </Row>
        ))}
      </Section>

      <Section title="Empty state">
        <div className="rounded-lg border border-border-subtle">
          <EmptyState
            icon={CircleDot}
            title="Nothing assigned yet"
            description="Issues assigned to you across every project will collect here."
            action={<Button size="sm">Browse projects</Button>}
          />
        </div>
      </Section>

      <KitchenSinkInteractive />

      <Section title="Type scale">
        <div className="space-y-1">
          <p className="text-2xs text-text-300">text-2xs · 10/14 · counts</p>
          <p className="text-xs text-text-300">text-xs · 11/16 · metadata</p>
          <p className="text-sm text-text-100">text-sm · 13/20 · body</p>
          <p className="text-base font-medium text-text-100">
            text-base · 14/20 · issue titles
          </p>
          <p className="text-lg font-medium text-text-100">
            text-lg · 16/24 · section headings
          </p>
          <p className="text-xl font-semibold text-text-100">
            text-xl · 20/28 · issue detail title
          </p>
          <p className="text-2xl font-semibold text-text-100">
            text-2xl · 24/32 · page titles
          </p>
        </div>
      </Section>

      <Section title="Surfaces">
        <div className="flex flex-wrap gap-3">
          {[
            ["bg-bg-100", "--bg-100"],
            ["bg-bg-90", "--bg-90"],
            ["bg-bg-80", "--bg-80"],
            ["bg-bg-70", "--bg-70"],
            ["bg-bg-60", "--bg-60"],
          ].map(([className, token]) => (
            <div key={token} className="flex flex-col items-center gap-1">
              <div
                className={`size-12 rounded-md border border-border-subtle ${className}`}
              />
              <span className="font-mono text-2xs text-text-400">{token}</span>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
