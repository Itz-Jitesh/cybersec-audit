import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading geometry that matches the page it stands in for, so the content does
 * not jump when it arrives. Never a spinner: docs/05-DESIGN-SYSTEM.md §5 rules
 * those out for anything under 400ms, and these routes are well under it.
 */
export function RouteSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="mx-auto max-w-[1200px] px-6 pt-4 pb-10">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-40" />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[74px] rounded-lg" />
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-border-subtle">
        <Skeleton className="h-10 rounded-t-lg rounded-b-none" />
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex h-row items-center gap-2.5 px-4">
            <Skeleton className="size-3.5 rounded-full" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
