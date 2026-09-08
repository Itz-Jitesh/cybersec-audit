import type { IssueLabel } from "@/components/shared/label-chip";
import type { MemberAvatarUser } from "@/components/shared/member-avatar";

/**
 * Fixtures for the development-only kitchen-sink route. These colours stand in
 * for values that come from the states and labels tables at runtime, which is
 * why they are literals here and why they live outside src/app and
 * src/components, where raw colour values are not permitted.
 *
 * Deleted along with the kitchen-sink route in phase 12.
 */

export const DEMO_USERS: MemberAvatarUser[] = [
  { id: "8f14e45f", displayName: "Aarav Menon" },
  { id: "c9f0f895", displayName: "Diya Sharma" },
  { id: "45c48cce", displayName: "Kabir Rao" },
  { id: "d3d94468", displayName: "Meera Iyer" },
  { id: "6512bd43", displayName: "Rohan Nair" },
  { id: "c20ad4d7", displayName: "Sana Qureshi" },
];

export const DEMO_LABELS: IssueLabel[] = [
  { id: "bug", name: "bug", color: "#ef4444" },
  { id: "feature", name: "feature", color: "#3f76ff" },
  { id: "documentation", name: "documentation", color: "#8b5cf6" },
  { id: "research", name: "research", color: "#14b8a6" },
  { id: "ctf", name: "ctf", color: "#f59e0b" },
  { id: "blocked", name: "blocked", color: "#f97316" },
  { id: "good-first-issue", name: "good-first-issue", color: "#16a34a" },
];

/** Stands in for a project-defined state colour overriding its group default. */
export const DEMO_CUSTOM_STATE_COLOR = "#a78bfa";
