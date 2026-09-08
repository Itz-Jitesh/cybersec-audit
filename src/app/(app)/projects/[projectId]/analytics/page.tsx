import { BarChart3 } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      icon={BarChart3}
      title="Analytics"
      description="Throughput, state distribution and overdue load"
      phase="phase 11"
    />
  );
}
