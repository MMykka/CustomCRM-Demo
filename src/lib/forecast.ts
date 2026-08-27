import "server-only";
import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type ForecastMonth = { month: string; label: string; count: number; value: number; weightedValue: number };
export type ForecastResult = { months: ForecastMonth[]; undated: { count: number; value: number }; currency: string };

// Groups open deals by expected_close_date's YYYY-MM. Deals with no close
// date are aggregated separately (never silently dropped or bucketed into
// "this month") since a forecast can't place them on a timeline.
export async function getForecastByMonth(supabase: SupabaseClient<Database>): Promise<ForecastResult> {
  const { data: deals, error } = await supabase
    .from("deals")
    .select("value, currency, expected_close_date, stage:stages(probability)")
    .eq("status", "open");
  if (error) throw error;

  const monthMap = new Map<string, ForecastMonth>();
  let undatedCount = 0;
  let undatedValue = 0;

  for (const deal of deals ?? []) {
    const probability = deal.stage?.probability ?? 0;
    const weighted = deal.value * (probability / 100);

    if (!deal.expected_close_date) {
      undatedCount += 1;
      undatedValue += deal.value;
      continue;
    }

    const monthKey = deal.expected_close_date.slice(0, 7);
    const existing = monthMap.get(monthKey) ?? {
      month: monthKey,
      label: format(new Date(`${monthKey}-01T00:00:00`), "MMM yyyy"),
      count: 0,
      value: 0,
      weightedValue: 0,
    };
    existing.count += 1;
    existing.value += deal.value;
    existing.weightedValue += weighted;
    monthMap.set(monthKey, existing);
  }

  const months = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  return { months, undated: { count: undatedCount, value: undatedValue }, currency: deals?.[0]?.currency ?? "USD" };
}
