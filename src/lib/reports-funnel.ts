import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { LifecycleStage } from "@/lib/types";

const LIFECYCLE_STAGES: LifecycleStage[] = ["subscriber", "lead", "mql", "sql", "opportunity", "customer", "evangelist", "other"];
const NONE_LABEL = "(none)";

export type FunnelBucket = { key: string; label: string; total: number } & Record<LifecycleStage, number>;
export type FunnelResult = { buckets: FunnelBucket[] };

function emptyByStage(): Record<LifecycleStage, number> {
  return Object.fromEntries(LIFECYCLE_STAGES.map((s) => [s, 0])) as Record<LifecycleStage, number>;
}

// One parameterized function for both "by source" and "by campaign" --
// the two columns are identically-shaped nullable free text, so writing
// this twice would be pure duplication with zero meaningful variation.
export async function getContactFunnel(supabase: SupabaseClient<Database>, field: "source" | "campaign"): Promise<FunnelResult> {
  const { data: contacts, error } = await supabase.from("contacts").select("source, campaign, lifecycle_stage");
  if (error) throw error;

  const buckets = new Map<string, FunnelBucket>();

  for (const contact of contacts ?? []) {
    const key = (field === "source" ? contact.source : contact.campaign) ?? NONE_LABEL;
    const bucket = buckets.get(key) ?? { key, label: key, total: 0, ...emptyByStage() };
    bucket.total += 1;
    const stage = (contact.lifecycle_stage as LifecycleStage) ?? "other";
    bucket[stage] += 1;
    buckets.set(key, bucket);
  }

  const sorted = [...buckets.values()].sort((a, b) => {
    if (a.key === NONE_LABEL) return 1;
    if (b.key === NONE_LABEL) return -1;
    return b.total - a.total;
  });

  return { buckets: sorted };
}
