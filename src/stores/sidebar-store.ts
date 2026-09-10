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
  /**
   * The drawer state below 1024px. Deliberately not persisted: a drawer that
   * reopens itself on the next page load is a bug, not a preference, which is
   * why it is excluded from partialize below.
   */
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
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
      mobileNavOpen: false,
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
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
      // Only the two real preferences are stored. mobileNavOpen is session
      // state and would otherwise be restored open on the next visit.
      partialize: (state) => ({
        isCollapsed: state.isCollapsed,
        expanded: state.expanded,
      }),
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
