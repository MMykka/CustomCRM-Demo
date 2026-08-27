import "server-only";
import { endOfMonth, startOfMonth } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { listOrgMembersForPicker } from "@/lib/actions/organizations";

export type RepLeaderboardRow = {
  id: string;
  name: string;
  contactsTouched: number;
  callsBooked: number;
  dealsWon: number;
};

const OUTREACH_ACTIVITY_TYPES = ["call", "email", "sms", "meeting"];

// Fixed to this calendar month -- the three metrics span different natural
// periods elsewhere on the dashboard (today/week/month), but a leaderboard
// needs one consistent period to rank fairly, and monthly is the standard
// CRM rep-performance cadence.
export async function getRepLeaderboard(supabase: SupabaseClient<Database>): Promise<RepLeaderboardRow[]> {
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const monthEnd = endOfMonth(now).toISOString();

  const [owners, { data: activities }, { data: messages }, { data: callTasks }, { data: wonDeals }] = await Promise.all([
    listOrgMembersForPicker(),
    supabase
      .from("activities")
      .select("user_id, contact_id")
      .in("type", OUTREACH_ACTIVITY_TYPES)
      .gte("created_at", monthStart)
      .lte("created_at", monthEnd),
    supabase.from("messages").select("user_id, contact_id").eq("direction", "outbound").gte("created_at", monthStart).lte("created_at", monthEnd),
    supabase
      .from("tasks")
      .select("assigned_to")
      .eq("type", "call")
      .neq("status", "cancelled")
      .gte("due_at", monthStart)
      .lte("due_at", monthEnd),
    supabase.from("deals").select("owner_id").eq("status", "won").gte("closed_at", monthStart).lte("closed_at", monthEnd),
  ]);

  const touchedContactsByRep = new Map<string, Set<string>>();
  function addTouch(userId: string | null, contactId: string | null) {
    if (!userId || !contactId) return;
    const set = touchedContactsByRep.get(userId) ?? new Set<string>();
    set.add(contactId);
    touchedContactsByRep.set(userId, set);
  }
  for (const a of activities ?? []) addTouch(a.user_id, a.contact_id);
  for (const m of messages ?? []) addTouch(m.user_id, m.contact_id);

  const callsBookedByRep = new Map<string, number>();
  for (const t of callTasks ?? []) {
    if (!t.assigned_to) continue;
    callsBookedByRep.set(t.assigned_to, (callsBookedByRep.get(t.assigned_to) ?? 0) + 1);
  }

  const dealsWonByRep = new Map<string, number>();
  for (const d of wonDeals ?? []) {
    if (!d.owner_id) continue;
    dealsWonByRep.set(d.owner_id, (dealsWonByRep.get(d.owner_id) ?? 0) + 1);
  }

  const rows: RepLeaderboardRow[] = owners.map((owner) => ({
    id: owner.id,
    name: owner.full_name ?? owner.email,
    contactsTouched: touchedContactsByRep.get(owner.id)?.size ?? 0,
    callsBooked: callsBookedByRep.get(owner.id) ?? 0,
    dealsWon: dealsWonByRep.get(owner.id) ?? 0,
  }));

  rows.sort((a, b) => b.dealsWon - a.dealsWon || b.contactsTouched - a.contactsTouched);
  return rows;
}
