import { Bell } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      icon={Bell}
      title="Notifications"
      description="Mentions and updates you are subscribed to"
      phase="phase 10, with the notification fan-out"
    />
  );
}
