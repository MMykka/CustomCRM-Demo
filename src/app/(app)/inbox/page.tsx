import { Inbox } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function InboxPage() {
  return (
    <ComingSoon
      icon={Inbox}
      title="Inbox"
      description="Unified SMS, email, and call inbox lands in a later phase — the messages table it'll read from already exists."
    />
  );
}
