import { Settings } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      icon={Settings}
      title="Admin"
      description="Members, invites, teams and the audit log"
      phase="phase 11"
    />
  );
}
