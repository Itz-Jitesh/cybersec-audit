import { RefreshCw } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      icon={RefreshCw}
      title="Cycles"
      description="Time-boxed batches of work with a burndown"
      phase="phase 10"
    />
  );
}
