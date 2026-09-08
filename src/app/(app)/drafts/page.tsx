import { FileText } from "lucide-react";

import { PlaceholderPage } from "@/components/layout/placeholder-page";

export default function Page() {
  return (
    <PlaceholderPage
      icon={FileText}
      title="Drafts"
      description="Issues you started but never submitted"
      phase="phase 8"
    />
  );
}
