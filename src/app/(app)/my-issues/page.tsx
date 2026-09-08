import { CircleDot } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      icon={CircleDot}
      title="My Issues"
      description="Your issues across every project land here"
      phase="phase 9, with the shared filter bar"
    />
  );
}
