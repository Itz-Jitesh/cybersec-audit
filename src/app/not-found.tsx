import { Compass } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg-100">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The address you followed does not lead anywhere in this workspace."
        action={
          <Button size="sm" variant="secondary" asChild>
            <Link href="/home">Go home</Link>
          </Button>
        }
      />
    </div>
  );
}
