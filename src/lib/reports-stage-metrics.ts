import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type StageMetricRow = {
  stageId: string;
  name: string;
  position: number;
  color: string;
  dealsEntered: number;
  dealsWon: number;
  conversionRate: number | null; // null when dealsEntered === 0, never divide by zero
  avgDaysInStage: number | null; // null when the stage has zero recorded occupancy intervals
};
export type StageMetricsResult = { pipelineId: string; pipelineName: string; stages: StageMetricRow[] };

type StageChangeMetadata = { from_stage_id: string; to_stage_id: string; outcome?: "won" | "lost" };
type Interval = { dealId: string; stageId: string; start: number; end: number; dealStatus: string };

// Reconstructs each deal's full stage-occupancy history from `activities`
// (type='stage_change', metadata: {from_stage_id, to_stage_id}). Deals never
// get a synthetic "entered stage" row on creation, so a deal's original
// stage (before its first-ever move) has to be recovered from the first
// transition's from_stage_id, with deals.created_at as that interval's
// start. Both conversion rate and avg-days-in-stage fall out of this same
// reconstruction, so they're computed together in one pass.
export async function getStageMetrics(supabase: SupabaseClient<Database>, pipelineId: string): Promise<StageMetricsResult> {
  const { data: pipeline } = await supabase.from("pipelines").select("id, name").eq("id", pipelineId).single();
  const { data: stages, error: stagesError } = await supabase
    .from("stages")
    .select("id, name, position, color")
    .eq("pipeline_id", pipelineId)
    .order("position");
  if (stagesError) throw stagesError;

  const { data: deals, error: dealsError } = await supabase
    .from("deals")
    .select("id, stage_id, status, created_at, closed_at")
    .eq("pipeline_id", pipelineId);
  if (dealsError) throw dealsError;

  const dealIds = (deals ?? []).map((d) => d.id);
  const { data: activities } =
    dealIds.length > 0
      ? await supabase
          .from("activities")
          .select("deal_id, created_at, metadata")
          .eq("type", "stage_change")
          .in("deal_id", dealIds)
          .order("created_at", { ascending: true })
      : { data: [] as { deal_id: string | null; created_at: string; metadata: unknown }[] };

  const changesByDeal = new Map<string, { created_at: string; metadata: StageChangeMetadata }[]>();
  for (const activity of activities ?? []) {
    if (!activity.deal_id) continue;
    const list = changesByDeal.get(activity.deal_id) ?? [];
    list.push({ created_at: activity.created_at, metadata: activity.metadata as StageChangeMetadata });
    changesByDeal.set(activity.deal_id, list);
  }

  const now = new Date().getTime();
  const intervals: Interval[] = [];

  for (const deal of deals ?? []) {
    const changes = changesByDeal.get(deal.id) ?? [];
    const end = () => (deal.status === "open" ? now : new Date(deal.closed_at ?? deal.created_at).getTime());

    if (changes.length === 0) {
      intervals.push({ dealId: deal.id, stageId: deal.stage_id, start: new Date(deal.created_at).getTime(), end: end(), dealStatus: deal.status });
      continue;
    }

    const first = changes[0]!;
    intervals.push({
      dealId: deal.id,
      stageId: first.metadata.from_stage_id,
      start: new Date(deal.created_at).getTime(),
      end: new Date(first.created_at).getTime(),
      dealStatus: deal.status,
    });

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i]!;
      const next = changes[i + 1];
      intervals.push({
        dealId: deal.id,
        stageId: change.metadata.to_stage_id,
        start: new Date(change.created_at).getTime(),
        end: next ? new Date(next.created_at).getTime() : end(),
        dealStatus: deal.status,
      });
    }
  }

  const stageRows: StageMetricRow[] = (stages ?? []).map((stage) => {
    const stageIntervals = intervals.filter((i) => i.stageId === stage.id);
    const dealIdSet = new Set(stageIntervals.map((i) => i.dealId));
    const dealsEntered = dealIdSet.size;
    const wonDealIds = new Set(stageIntervals.filter((i) => i.dealStatus === "won").map((i) => i.dealId));

    const totalDays = stageIntervals.reduce((sum, i) => sum + Math.max(0, i.end - i.start) / 86400000, 0);

    return {
      stageId: stage.id,
      name: stage.name,
      position: stage.position,
      color: stage.color,
      dealsEntered,
      dealsWon: wonDealIds.size,
      conversionRate: dealsEntered > 0 ? wonDealIds.size / dealsEntered : null,
      avgDaysInStage: stageIntervals.length > 0 ? totalDays / stageIntervals.length : null,
    };
  });

  return { pipelineId, pipelineName: pipeline?.name ?? "", stages: stageRows };
}
