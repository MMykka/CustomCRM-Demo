import "server-only";
import { endOfWeek, startOfWeek } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type SpeedToLeadResult = {
  averageMinutes: number | null;
  touchedCount: number;
  untouchedCount: number;
};

const OUTREACH_ACTIVITY_TYPES = ["call", "email", "sms", "meeting"];

// For contacts created this week, first touch = the earliest of their
// outreach-type activities or outbound messages. Contacts with zero touches
// so far are excluded from the average and counted separately -- never
// dropped, never coerced to 0 minutes (mirrors the Forecast widget's
// undated-deals callout pattern).
export async function getSpeedToLead(supabase: SupabaseClient<Database>): Promise<SpeedToLeadResult> {
  const now = new Date();
  const weekStart = startOfWeek(now).toISOString();
  const weekEnd = endOfWeek(now).toISOString();

  const { data: newContacts, error } = await supabase.from("contacts").select("id, created_at").gte("created_at", weekStart).lte("created_at", weekEnd);
  if (error) throw error;

  if (!newContacts || newContacts.length === 0) {
    return { averageMinutes: null, touchedCount: 0, untouchedCount: 0 };
  }

  const contactIds = newContacts.map((c) => c.id);

  const [{ data: activities }, { data: messages }] = await Promise.all([
    supabase.from("activities").select("contact_id, created_at").in("contact_id", contactIds).in("type", OUTREACH_ACTIVITY_TYPES),
    supabase.from("messages").select("contact_id, created_at").in("contact_id", contactIds).eq("direction", "outbound"),
  ]);

  const firstTouchByContact = new Map<string, number>();
  function considerTouch(contactId: string | null, createdAt: string) {
    if (!contactId) return;
    const time = new Date(createdAt).getTime();
    const existing = firstTouchByContact.get(contactId);
    if (existing === undefined || time < existing) firstTouchByContact.set(contactId, time);
  }
  for (const a of activities ?? []) considerTouch(a.contact_id, a.created_at);
  for (const m of messages ?? []) considerTouch(m.contact_id, m.created_at);

  let totalMinutes = 0;
  let touchedCount = 0;
  for (const contact of newContacts) {
    const firstTouch = firstTouchByContact.get(contact.id);
    if (firstTouch === undefined) continue;
    const minutes = (firstTouch - new Date(contact.created_at).getTime()) / 60000;
    totalMinutes += Math.max(0, minutes);
    touchedCount += 1;
  }

  return {
    averageMinutes: touchedCount > 0 ? totalMinutes / touchedCount : null,
    touchedCount,
    untouchedCount: newContacts.length - touchedCount,
  };
}
