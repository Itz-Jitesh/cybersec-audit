"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  DisplayProps,
  IssueLayout,
  SavedFilters,
} from "@/lib/validators/view";

/** What a person has set up for one project's issue view. */
export interface ProjectViewState {
  layout: IssueLayout;
  filters: Partial<SavedFilters>;
  displayProps: DisplayProps;
}

interface ProjectViewStore {
  /** Keyed by project id, so two projects never share a layout or a filter. */
  byProject: Record<string, ProjectViewState>;
  /**
   * False until the persisted snapshot merges. The issue screen falls back to
   * list/default filters while false, matching the server HTML.
   */
  hasHydrated: boolean;
  setHydratedTrue: () => void;
  setLayout: (projectId: string, layout: IssueLayout) => void;
  setFilters: (projectId: string, filters: Partial<SavedFilters>) => void;
  setDisplayProps: (projectId: string, displayProps: DisplayProps) => void;
  /** Applies a saved view wholesale — layout, filters and display at once. */
  applyView: (projectId: string, state: ProjectViewState) => void;
  reset: (projectId: string) => void;
}

/**
 * Layout, filters and display properties for each project, in localStorage.
 *
 * This is what makes switching layouts preserve filters: the four layouts read
 * one filter object rather than each holding their own, so moving from list to
 * kanban changes which component renders and nothing else. It is also why the
 * filter survives a reload — losing a filter set on every navigation is the
 * difference between a view you configure and one you re-configure.
 *
 * Saved views live in Postgres instead, because they are shared and named. This
 * store holds the unnamed working state, which is per-person and disposable.
 */
export const useProjectViewStore = create<ProjectViewStore>()(
  persist(
    (set) => ({
      byProject: {},
      hasHydrated: false,
      setHydratedTrue: () => set({ hasHydrated: true }),

      setLayout: (projectId, layout) =>
        set((store) => ({
          byProject: {
            ...store.byProject,
            [projectId]: {
              ...store.byProject[projectId],
              layout,
            } as ProjectViewState,
          },
        })),

      setFilters: (projectId, filters) =>
        set((store) => ({
          byProject: {
            ...store.byProject,
            [projectId]: {
              ...store.byProject[projectId],
              filters,
            } as ProjectViewState,
          },
        })),

      setDisplayProps: (projectId, displayProps) =>
        set((store) => ({
          byProject: {
            ...store.byProject,
            [projectId]: {
              ...store.byProject[projectId],
              displayProps,
            } as ProjectViewState,
          },
        })),

      applyView: (projectId, state) =>
        set((store) => ({
          byProject: { ...store.byProject, [projectId]: state },
        })),

      reset: (projectId) =>
        set((store) => {
          const next = { ...store.byProject };
          delete next[projectId];
          return { byProject: next };
        }),
    }),
    { name: "project-view-state",
      version: 1,
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHydratedTrue?.();
      },
    },
  ),
);
