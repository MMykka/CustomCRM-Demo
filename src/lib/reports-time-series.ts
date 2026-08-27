import "server-only";
import { eachMonthOfInterval, format, startOfMonth, subMonths } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type MonthCount = { month: string; label: string; count: number };
export type MonthRevenue = { month: string; label: string; value: number };

const MONTHS_BACK = 11; // 12 months total including the current one

function last12MonthKeys(): { month: string; label: string }[] {
  const now = new Date();
  return eachMonthOfInterval({ start: subMonths(startOfMonth(now), MONTHS_BACK), end: now }).map((date) => ({
    month: format(date, "yyyy-MM"),
    label: format(date, "MMM yyyy"),
  }));
}

// Unlike forecast.ts (forward-looking, gaps are meaningful "nothing
// scheduled"), these are backward-looking trend charts where every one of
// the last 12 months should render, including zero-count/zero-revenue ones
// -- an absent bar would look like a bug, not "no data."
export async function getLeadVolumeByMonth(supabase: SupabaseClient<Database>): Promise<{ months: MonthCount[] }> {
  const since = subMonths(startOfMonth(new Date()), MONTHS_BACK).toISOString();

  const { data: contacts, error } = await supabase.from("contacts").select("created_at").gte("created_at", since);
  if (error) throw error;

  const monthMap = new Map<string, MonthCount>(last12MonthKeys().map((m) => [m.month, { ...m, count: 0 }]));

  for (const contact of contacts ?? []) {
    const monthKey = contact.created_at.slice(0, 7);
    const bucket = monthMap.get(monthKey);
    if (bucket) bucket.count += 1;
  }

  return { months: [...monthMap.values()] };
}

export async function getWonRevenueByMonth(supabase: SupabaseClient<Database>): Promise<{ months: MonthRevenue[]; currency: string }> {
  const since = subMonths(startOfMonth(new Date()), MONTHS_BACK).toISOString();

  const { data: deals, error } = await supabase.from("deals").select("value, currency, closed_at").eq("status", "won").gte("closed_at", since);
  if (error) throw error;

  const monthMap = new Map<string, MonthRevenue>(last12MonthKeys().map((m) => [m.month, { ...m, value: 0 }]));

  for (const deal of deals ?? []) {
    if (!deal.closed_at) continue;
    const monthKey = deal.closed_at.slice(0, 7);
    const bucket = monthMap.get(monthKey);
    if (bucket) bucket.value += deal.value;
  }

  return { months: [...monthMap.values()], currency: deals?.[0]?.currency ?? "USD" };
}
