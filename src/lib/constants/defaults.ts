/**
 * Seeded into a project when it is created, not inserted globally by the seed
 * script — every project owns its own states and labels so a team can adjust
 * its workflow without affecting anyone else.
 *
 * The state colours are the --state-* token values from
 * docs/05-DESIGN-SYSTEM.md §1. They are literals here because they are written
 * into the states table as data, which is what components then read at runtime.
 */

import type { StateGroup } from "@/components/shared/state-icon";

export interface DefaultState {
  name: string;
  group: StateGroup;
  color: string;
  sequence: number;
  isDefault: boolean;
}

export const DEFAULT_STATES: readonly DefaultState[] = [
  {
    name: "Backlog",
    group: "backlog",
    color: "#6b7280",
    sequence: 1000,
    isDefault: false,
  },
  {
    name: "Todo",
    group: "unstarted",
    color: "#9ca3af",
    sequence: 2000,
    isDefault: true,
  },
  {
    name: "In Progress",
    group: "started",
    color: "#f59e0b",
    sequence: 3000,
    isDefault: false,
  },
  {
    name: "In Review",
    group: "started",
    color: "#f59e0b",
    sequence: 4000,
    isDefault: false,
  },
  {
    name: "Done",
    group: "completed",
    color: "#16a34a",
    sequence: 5000,
    isDefault: false,
  },
  {
    name: "Cancelled",
    group: "cancelled",
    color: "#ef4444",
    sequence: 6000,
    isDefault: false,
  },
] as const;

export interface DefaultLabel {
  name: string;
  color: string;
}

export const DEFAULT_LABELS: readonly DefaultLabel[] = [
  { name: "bug", color: "#ef4444" },
  { name: "feature", color: "#3f76ff" },
  { name: "documentation", color: "#8b5cf6" },
  { name: "research", color: "#14b8a6" },
  { name: "ctf", color: "#f59e0b" },
  { name: "blocked", color: "#f97316" },
  { name: "good-first-issue", color: "#16a34a" },
] as const;

/** Teams the workspace ships with. Extensible from the admin panel later. */
export const DEFAULT_TEAMS = [
  { name: "Tech", slug: "tech", color: "#3f76ff" },
  { name: "Design", slug: "design", color: "#8b5cf6" },
  { name: "R&D", slug: "rnd", color: "#14b8a6" },
] as const;

export const WORKSPACE_NAME = "Cybersec AIT";
