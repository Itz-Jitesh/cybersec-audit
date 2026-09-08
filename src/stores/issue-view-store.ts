"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface IssueViewState {
  /** Collapsed group ids, keyed by project so two projects do not share state. */
  collapsed: Record<string, string[]>;
  toggleGroup: (projectId: string, groupId: string) => void;
  isCollapsed: (projectId: string, groupId: string) => boolean;
}

/**
 * Which groups are folded is a per-user preference, so it lives in localStorage
 * and never round-trips to the server. Selection deliberately does not live
 * here: it is per-view, transient, and should not survive a reload.
 */
export const useIssueViewStore = create<IssueViewState>()(
  persist(
    (set, get) => ({
      collapsed: {},
      toggleGroup: (projectId, groupId) =>
        set((state) => {
          const current = state.collapsed[projectId] ?? [];
          const next = current.includes(groupId)
            ? current.filter((id) => id !== groupId)
            : [...current, groupId];
          return { collapsed: { ...state.collapsed, [projectId]: next } };
        }),
      isCollapsed: (projectId, groupId) =>
        (get().collapsed[projectId] ?? []).includes(groupId),
    }),
    { name: "issue-view-state" },
  ),
);
