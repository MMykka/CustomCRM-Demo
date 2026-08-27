import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { activityTitle, type TimelineEvent, type TimelineEventType } from "@/lib/timeline";

// Company-level rollup of the same unified timeline used on the contact
// page: everything tied directly to the company (activities/notes with
// company_id set) plus everything tied to any of its contacts (activities,
// messages, notes) -- a company's timeline is the union of its own events
// and its contacts' events. Sequence enrollments are contact-scoped only
// in this schema, so those are rolled up per-contact the same way.
export async function getCompanyTimeline(supabase: SupabaseClient<Database>, companyId: string, contactIds: string[]): Promise<TimelineEvent[]> {
  const contactFilter = contactIds.length > 0 ? contactIds : ["00000000-0000-0000-0000-000000000000"];

  const [{ data: activities }, { data: messages }, { data: notes }, { data: enrollments }] = await Promise.all([
    supabase
      .from("activities")
      .select("*, user:users(full_name, email)")
      .or(`company_id.eq.${companyId},contact_id.in.(${contactFilter.join(",")})`),
    supabase.from("messages").select("*, user:users(full_name, email)").in("contact_id", contactFilter),
    supabase
      .from("notes")
      .select("*, author:users!notes_author_id_fkey(full_name, email)")
      .or(`company_id.eq.${companyId},contact_id.in.(${contactFilter.join(",")})`),
    supabase.from("sequence_enrollments").select("*, sequence:sequences(name)").in("contact_id", contactFilter),
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
