import { Box } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

/**
 * Deliberately distinct from the permission-denied screen. A project that does
 * not exist and a project you cannot open are different problems with different
 * next steps, and collapsing them into one message leaves the reader guessing.
 */
export default function ProjectNotFound() {
  return (
    <EmptyState
      icon={Box}
      title="This project does not exist"
      description="It may have been deleted, or the link may be wrong."
      action={
        <Button size="sm" variant="secondary" asChild>
          <Link href="/home">Go home</Link>
        </Button>
      }
    />
  );
}
