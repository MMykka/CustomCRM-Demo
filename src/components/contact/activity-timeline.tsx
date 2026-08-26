"use client";

import { useRef, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { StickyNote, Phone, Mail, MessageSquare, Users, ArrowRightLeft, CheckCircle2, FileText, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addActivityNote } from "@/lib/actions/contacts";
import type { Activity, ActivityType } from "@/lib/types";

const ACTIVITY_ICONS: Record<ActivityType, typeof StickyNote> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  meeting: Users,
  stage_change: ArrowRightLeft,
  task_completed: CheckCircle2,
  form_submission: FileText,
  other: Circle,
};

const CALL_OUTCOME_LABELS: Record<string, string> = {
  connected: "Connected",
  voicemail: "Voicemail",
  no_answer: "No answer",
  busy: "Busy",
};

function activitySummary(activity: ActivityWithUser) {
  const metadata = (activity.metadata ?? {}) as Record<string, unknown>;

  if (activity.type === "call" && typeof metadata.outcome === "string") {
    const outcome = CALL_OUTCOME_LABELS[metadata.outcome] ?? metadata.outcome;
    const minutes = typeof metadata.duration_seconds === "number" ? Math.round(metadata.duration_seconds / 60) : null;
    return `Call · ${outcome}${minutes ? ` · ${minutes}m` : ""}`;
  }

  if (activity.type === "meeting" && typeof metadata.duration_minutes === "number") {
    const attendees = Array.isArray(metadata.attendees) ? metadata.attendees.length : 0;
    return `Meeting · ${metadata.duration_minutes}m${attendees ? ` · ${attendees} attendee${attendees === 1 ? "" : "s"}` : ""}`;
  }

  return null;
}

export type ActivityWithUser = Activity & { user: { full_name: string | null; email: string } | null };

export function ActivityTimeline({ contactId, activities }: { contactId: string; activities: ActivityWithUser[] }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-6">
      <form
        ref={formRef}
        action={(formData) => {
          const body = String(formData.get("body") ?? "");
          startTransition(async () => {
            await addActivityNote(contactId, body);
            formRef.current?.reset();
          });
        }}
        className="flex flex-col gap-2"
      >
        <Textarea name="body" placeholder="Add a note..." rows={3} required />
        <div>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Adding..." : "Add note"}
          </Button>
        </div>
      </form>

      <ol className="flex flex-col gap-4">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          activities.map((activity) => {
            const Icon = ACTIVITY_ICONS[activity.type as ActivityType] ?? Circle;
            const author = activity.user?.full_name ?? activity.user?.email ?? "System";
            const summary = activitySummary(activity);
            return (
              <li key={activity.id} className="flex gap-3">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="size-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{author}</span>{" "}
                    <span className="text-muted-foreground">
                      {activity.type === "stage_change" ? "moved the deal to a new stage" : activityLabel(activity.type as ActivityType)}
                    </span>
                  </p>
                  {summary ? <p className="text-xs font-medium text-foreground">{summary}</p> : null}
                  {activity.body ? <p className="text-sm">{activity.body}</p> : null}
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</p>
                </div>
              </li>
            );
          })
        )}
      </ol>
    </div>
  );
}

function activityLabel(type: ActivityType) {
  switch (type) {
    case "note":
      return "added a note";
    case "call":
      return "logged a call";
    case "email":
      return "sent an email";
    case "sms":
      return "sent a text";
    case "meeting":
      return "logged a meeting";
    case "task_completed":
      return "completed a task";
    case "form_submission":
      return "submitted a form";
    default:
      return "logged an activity";
  }
}
