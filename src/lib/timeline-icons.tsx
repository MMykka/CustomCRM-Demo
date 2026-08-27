import { StickyNote, Phone, Mail, MessageSquare, Users, ArrowRightLeft, CheckCircle2, FileText, Repeat, Circle } from "lucide-react";
import type { TimelineEventType } from "@/lib/timeline";

export const TIMELINE_TYPE_ICONS: Record<TimelineEventType, typeof StickyNote> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  meeting: Users,
  stage_change: ArrowRightLeft,
  task_completed: CheckCircle2,
  form_submission: FileText,
  sequence_enrolled: Repeat,
  sequence_completed: Repeat,
  other: Circle,
};
