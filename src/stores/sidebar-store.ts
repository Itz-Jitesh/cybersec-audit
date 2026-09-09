"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  isCollapsed: boolean;
  /** Keyed by section id: team ids, project ids, and the literal "favorites". */
  expanded: Record<string, boolean>;
  /**
   * False on the server and on the first client render, true once the
   * localStorage snapshot has been merged. Components must render defaults
   * while false or the server HTML and the first client render diverge.
   */
  hasHydrated: boolean;
  setHydratedTrue: () => void;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleSection: (id: string) => void;
  isExpanded: (id: string, fallback?: boolean) => boolean;
}

/**
 * Sidebar shape is a preference, not application state, so it lives in
 * localStorage and never round-trips to the server. Expansion defaults to open
 * for a section that has never been touched, which is why isExpanded takes a
 * fallback rather than treating a missing key as closed.
 */
export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      isCollapsed: false,
      expanded: {},
      hasHydrated: false,
      setHydratedTrue: () => set({ hasHydrated: true }),
      toggleCollapsed: () =>
        set((state) => ({ isCollapsed: !state.isCollapsed })),
      setCollapsed: (isCollapsed) => set({ isCollapsed }),
      toggleSection: (id) =>
        set((state) => ({
          expanded: { ...state.expanded, [id]: !(state.expanded[id] ?? true) },
        })),
      isExpanded: (id, fallback = true) => get().expanded[id] ?? fallback,
    }),
    {
      name: "sidebar-state",
      // Render the server defaults until the localStorage snapshot has merged.
      // Otherwise the first client render reads stored collapsed/expanded
      // values the server never saw, and React throws a hydration mismatch.
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHydratedTrue?.();
      },
    },
  ),
);
