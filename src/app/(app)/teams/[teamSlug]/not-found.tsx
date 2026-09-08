import { Users } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function TeamNotFound() {
  return (
    <EmptyState
      icon={Users}
      title="This team does not exist"
      description="Check the link, or pick a team from the sidebar."
      action={
        <Button size="sm" variant="secondary" asChild>
          <Link href="/home">Go home</Link>
        </Button>
      }
    />
  );
}
