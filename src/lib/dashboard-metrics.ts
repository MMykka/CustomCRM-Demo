import "server-only";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type DashboardCardMetrics = {
  newLeadsToday: number;
  callsBookedThisWeek: number;
  dealsWonThisMonth: { count: number; value: number; currency: string };
  repliesWaiting: number;
};

// "Booking a call" in this app is a due-dated type='call' task (see
// quick-task-dialog.tsx's comment) -- completed calls still count as
// having been booked, only cancelled ones don't.
export async function getDashboardCardMetrics(
  supabase: SupabaseClient<Database>,
  startOfDay: Date,
  endOfDay: Date,
): Promise<DashboardCardMetrics> {
  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [{ count: newLeadsToday }, { count: callsBookedThisWeek }, { data: wonDeals }, repliesWaiting] = await Promise.all([
    supabase
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("lifecycle_stage", "lead")
      .gte("created_at", startOfDay.toISOString())
      .lte("created_at", endOfDay.toISOString()),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("type", "call")
      .neq("status", "cancelled")
      .gte("due_at", weekStart.toISOString())
      .lte("due_at", weekEnd.toISOString()),
    supabase
      .from("deals")
      .select("value, currency")
      .eq("status", "won")
      .gte("closed_at", monthStart.toISOString())
      .lte("closed_at", monthEnd.toISOString()),
    getRepliesWaiting(supabase),
  ]);

  const dealsWonThisMonth = {
    count: wonDeals?.length ?? 0,
    value: (wonDeals ?? []).reduce((sum, d) => sum + d.value, 0),
    currency: wonDeals?.[0]?.currency ?? "USD",
  };

  return {
    newLeadsToday: newLeadsToday ?? 0,
    callsBookedThisWeek: callsBookedThisWeek ?? 0,
    dealsWonThisMonth,
    repliesWaiting,
  };
}

// No `replied_at`/thread tracking exists on `messages`, so "waiting for a
// reply" is inferred: a contact is waiting if their most-recent message is
// inbound (nothing has been sent back since). Fetches every message rather
// than a bounded page since truncating by recency could drop the oldest
// (most urgent) unanswered threads.
async function getRepliesWaiting(supabase: SupabaseClient<Database>): Promise<number> {
  const { data, error } = await supabase.from("messages").select("contact_id, direction, created_at").order("created_at", { ascending: false });
  if (error) throw error;

  const latestDirectionByContact = new Map<string, string>();
  for (const row of data ?? []) {
    if (!row.contact_id) continue;
    if (!latestDirectionByContact.has(row.contact_id)) latestDirectionByContact.set(row.contact_id, row.direction);
  }

  return [...latestDirectionByContact.values()].filter((direction) => direction === "inbound").length;
}
