import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { activityTitle, type TimelineEventType } from "@/lib/timeline";
import { contactDisplayName } from "@/lib/types";

export type TeamFeedItem = {
  id: string;
  type: TimelineEventType;
  occurredAt: string;
  actor: string | null;
  title: string;
  contact: { id: string; name: string } | null;
};

// Org-wide feed for the dashboard, distinct from timeline.ts's
// getContactTimeline: that fetches ALL rows for one (bounded) contact and
// sorts in JS; this must bound at the query level first (limit each source
// before merging) since an org's whole history could be large.
export async function getTeamActivityFeed(supabase: SupabaseClient<Database>, limit = 20): Promise<TeamFeedItem[]> {
  const [{ data: activities }, { data: messages }] = await Promise.all([
    supabase
      .from("activities")
      .select("id, type, created_at, user:users(full_name, email), contact:contacts(id, first_name, last_name, email)")
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("messages")
      .select("id, channel, direction, created_at, user:users(full_name, email), contact:contacts(id, first_name, last_name, email)")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const items: TeamFeedItem[] = [];

  for (const a of activities ?? []) {
    items.push({
      id: `activity-${a.id}`,
      type: a.type as TimelineEventType,
      occurredAt: a.created_at,
      actor: a.user?.full_name ?? a.user?.email ?? null,
      title: activityTitle(a.type),
      contact: a.contact ? { id: a.contact.id, name: contactDisplayName(a.contact) } : null,
    });
  }

  for (const m of messages ?? []) {
    const channelLabel = m.channel === "sms" ? "a text" : "an email";
    items.push({
      id: `message-${m.id}`,
      type: m.channel === "sms" ? "sms" : "email",
      occurredAt: m.created_at,
      actor: m.user?.full_name ?? m.user?.email ?? null,
      title: m.direction === "outbound" ? `Sent ${channelLabel}` : `Received ${channelLabel}`,
      contact: m.contact ? { id: m.contact.id, name: contactDisplayName(m.contact) } : null,
    });
  }

  items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return items.slice(0, limit);
}
