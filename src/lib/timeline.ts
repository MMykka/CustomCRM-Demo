import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type TimelineEventType =
  | "note"
  | "call"
  | "email"
  | "sms"
  | "meeting"
  | "stage_change"
  | "task_completed"
  | "form_submission"
  | "sequence_enrolled"
  | "sequence_completed"
  | "other";

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  occurredAt: string;
  actor: string | null;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
};

// Merges activities + messages + notes into one chronological feed, plus
// synthetic sequence-enrollment events. There's no per-step sequence event
// log in this schema (sequence_enrollments only tracks a current_step
// pointer), so step-by-step sequence history isn't representable here --
// only enrollment start/end.
export async function getContactTimeline(supabase: SupabaseClient<Database>, contactId: string): Promise<TimelineEvent[]> {
  const [{ data: activities }, { data: messages }, { data: notes }, { data: enrollments }] = await Promise.all([
    supabase.from("activities").select("*, user:users(full_name, email)").eq("contact_id", contactId),
    supabase.from("messages").select("*, user:users(full_name, email)").eq("contact_id", contactId),
    supabase.from("notes").select("*, author:users!notes_author_id_fkey(full_name, email)").eq("contact_id", contactId),
    supabase.from("sequence_enrollments").select("*, sequence:sequences(name)").eq("contact_id", contactId),
  ]);

  const events: TimelineEvent[] = [];

  for (const a of activities ?? []) {
    events.push({
      id: `activity-${a.id}`,
      type: a.type as TimelineEventType,
      occurredAt: a.created_at,
      actor: a.user?.full_name ?? a.user?.email ?? null,
      title: activityTitle(a.type),
      body: a.body,
      metadata: (a.metadata as Record<string, unknown>) ?? {},
    });
  }

  for (const m of messages ?? []) {
    const channelLabel = m.channel === "sms" ? "a text" : "an email";
    events.push({
      id: `message-${m.id}`,
      type: m.channel === "sms" ? "sms" : "email",
      occurredAt: m.created_at,
      actor: m.user?.full_name ?? m.user?.email ?? null,
      title: m.direction === "outbound" ? `Sent ${channelLabel}` : `Received ${channelLabel}`,
      body: m.subject ? `${m.subject}\n${m.body ?? ""}` : m.body,
      metadata: { direction: m.direction, status: m.status },
    });
  }

  for (const n of notes ?? []) {
    events.push({
      id: `note-${n.id}`,
      type: "note",
      occurredAt: n.created_at,
      actor: n.author?.full_name ?? n.author?.email ?? null,
      title: "Added a note",
      body: n.body,
      metadata: { pinned: n.is_pinned },
    });
  }

  for (const e of enrollments ?? []) {
    const sequenceName = e.sequence?.name ?? "a sequence";
    events.push({
      id: `enrollment-start-${e.id}`,
      type: "sequence_enrolled",
      occurredAt: e.enrolled_at,
      actor: null,
      title: `Enrolled in ${sequenceName}`,
      body: null,
      metadata: {},
    });
    if (e.completed_at) {
      events.push({
        id: `enrollment-end-${e.id}`,
        type: "sequence_completed",
        occurredAt: e.completed_at,
        actor: null,
        title: `${e.status === "completed" ? "Completed" : "Exited"} ${sequenceName}`,
        body: null,
        metadata: {},
      });
    }
  }

  events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return events.slice(0, 200);
}

function activityTitle(type: string) {
  switch (type) {
    case "note":
      return "Added a note";
    case "call":
      return "Logged a call";
    case "meeting":
      return "Logged a meeting";
    case "stage_change":
      return "Moved the deal to a new stage";
    case "task_completed":
      return "Completed a task";
    case "form_submission":
      return "Submitted a form";
    default:
      return "Logged an activity";
  }
}
