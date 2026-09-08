import { Settings } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      icon={Settings}
      title="Project settings"
      description="General, members, states, labels and the danger zone"
      phase="phase 7"
    />
  );
}
