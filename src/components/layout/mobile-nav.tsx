"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useSidebarStore } from "@/stores/sidebar-store";

/**
 * The sidebar as a drawer below 1024px.
 *
 * The same AppSidebar is rendered inside rather than a second navigation
 * built for small screens — two navigations drift apart, and the one nobody
 * uses daily is the one that rots. It is passed in as children so this file
 * stays free of the sidebar's data props.
 */
export function MobileNav({ children }: { children: React.ReactNode }) {
  const open = useSidebarStore((state) => state.mobileNavOpen);
  const setOpen = useSidebarStore((state) => state.setMobileNavOpen);
  const pathname = usePathname();

  // A drawer that stays open over the page you just navigated to is the
  // classic mobile-nav bug: the tap succeeds and looks like it did nothing.
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className="w-sidebar gap-0 border-border-subtle bg-bg-90 p-0 [&>button]:top-3.5 [&>button]:right-3"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
