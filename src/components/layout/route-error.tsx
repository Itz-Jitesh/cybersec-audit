"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

/**
 * The body of every error.tsx. Shows the real message rather than a generic
 * apology: at this scale the person reading it is usually a club member who can
 * report something useful, and hiding the cause helps nobody.
 */
export function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Something went wrong"
      description={error.message || "An unexpected error occurred."}
      action={
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
          <Button size="sm" variant="secondary" asChild>
            <Link href="/home">Go home</Link>
          </Button>
        </div>
      }
    />
  );
}
