import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { activityTitle, type TimelineEvent, type TimelineEventType } from "@/lib/timeline";

// Deals have no messages or sequence enrollments of their own -- those are
// contact-only concepts -- so a deal's timeline is just activities (which
// doubles as stage history via "stage_change" entries) + notes.
export async function getDealTimeline(supabase: SupabaseClient<Database>, dealId: string): Promise<TimelineEvent[]> {
  const [{ data: activities }, { data: notes }] = await Promise.all([
    supabase.from("activities").select("*, user:users(full_name, email)").eq("deal_id", dealId),
    supabase.from("notes").select("*, author:users!notes_author_id_fkey(full_name, email)").eq("deal_id", dealId),
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

  events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return events.slice(0, 200);
}
