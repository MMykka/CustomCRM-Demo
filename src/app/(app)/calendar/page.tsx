import { CalendarDays } from "lucide-react";
import { ComingSoon } from "@/components/coming-soon";

export default function CalendarPage() {
  return (
    <ComingSoon
      icon={CalendarDays}
      title="Calendar"
      description="Booking pages and scheduled meetings land in a later phase."
    />
  );
}
