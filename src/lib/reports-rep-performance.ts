import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { listOrgMembersForPicker } from "@/lib/actions/organizations";

export type RepPerformanceRow = {
  id: string;
  name: string;
  dealsWon: number;
  revenueWon: number;
  currency: string;
  winRate: number | null; // null when the rep has zero closed (won+lost) deals -- display "--", not "0%"
  contactsTouched: number;
};

const OUTREACH_ACTIVITY_TYPES = ["call", "email", "sms", "meeting"];

// All-time (not fixed-to-month like dashboard-leaderboard.ts, which is a
// deliberately different, already-shipped widget) -- a Reports rep table is
// a historical performance summary, and this page has no global date-range
// picker, so "all time" is the only period that needs no extra UI.
export async function getRepPerformanceAllTime(supabase: SupabaseClient<Database>): Promise<RepPerformanceRow[]> {
  const [owners, { data: activities }, { data: messages }, { data: closedDeals }] = await Promise.all([
    listOrgMembersForPicker(),
    supabase.from("activities").select("user_id, contact_id").in("type", OUTREACH_ACTIVITY_TYPES),
    supabase.from("messages").select("user_id, contact_id").eq("direction", "outbound"),
    supabase.from("deals").select("owner_id, status, value, currency").in("status", ["won", "lost"]),
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

  const wonByRep = new Map<string, { count: number; revenue: number; currency: string }>();
  const closedCountByRep = new Map<string, number>();

  for (const deal of closedDeals ?? []) {
    if (!deal.owner_id) continue;
    closedCountByRep.set(deal.owner_id, (closedCountByRep.get(deal.owner_id) ?? 0) + 1);
    if (deal.status === "won") {
      const existing = wonByRep.get(deal.owner_id) ?? { count: 0, revenue: 0, currency: deal.currency };
      existing.count += 1;
      existing.revenue += deal.value;
      wonByRep.set(deal.owner_id, existing);
    }
  }

  const rows: RepPerformanceRow[] = owners.map((owner) => {
    const won = wonByRep.get(owner.id);
    const closedCount = closedCountByRep.get(owner.id) ?? 0;
    return {
      id: owner.id,
      name: owner.full_name ?? owner.email,
      dealsWon: won?.count ?? 0,
      revenueWon: won?.revenue ?? 0,
      currency: won?.currency ?? "USD",
      winRate: closedCount > 0 ? (won?.count ?? 0) / closedCount : null,
      contactsTouched: touchedContactsByRep.get(owner.id)?.size ?? 0,
    };
  });

  rows.sort((a, b) => b.dealsWon - a.dealsWon || b.revenueWon - a.revenueWon);
  return rows;
}
