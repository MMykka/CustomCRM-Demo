import Link from "next/link";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { KanbanBoard, type DealWithRelations } from "@/components/pipeline/kanban-board";
import { PipelineSwitcher } from "@/components/pipeline/pipeline-switcher";
import { PipelineFilterBar } from "@/components/pipeline/pipeline-filter-bar";
import { listOrgMembersForPicker } from "@/lib/actions/organizations";
import { isDealStale, parsePipelineFilters } from "@/lib/pipeline-filters";
import type { DealMeta } from "@/components/pipeline/deal-card";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const appUser = await requireAppUser();
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const filters = parsePipelineFilters(resolvedSearchParams);

  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("*")
    .eq("organization_id", appUser.organization_id!)
    .order("is_default", { ascending: false })
    .order("position");

  const requestedPipelineId = Array.isArray(resolvedSearchParams.pipeline) ? resolvedSearchParams.pipeline[0] : resolvedSearchParams.pipeline;
  const pipeline = pipelines?.find((p) => p.id === requestedPipelineId) ?? pipelines?.[0];

  if (!pipeline) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">No pipeline found yet.</p>
      </div>
    );
  }

  const { data: stages } = await supabase.from("stages").select("*").eq("pipeline_id", pipeline.id).order("position");

  let dealsQuery = supabase
    .from("deals")
    .select("*, contact:contacts(id, first_name, last_name, email), company:companies(id, name), owner:users(id, full_name, email)")
    .eq("pipeline_id", pipeline.id)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (filters.ownerIds.length) dealsQuery = dealsQuery.in("owner_id", filters.ownerIds);
  if (filters.valueMin !== null) dealsQuery = dealsQuery.gte("value", filters.valueMin);
  if (filters.valueMax !== null) dealsQuery = dealsQuery.lte("value", filters.valueMax);

  const [{ data: deals }, owners] = await Promise.all([dealsQuery, listOrgMembersForPicker()]);

  let dealRows = (deals ?? []) as DealWithRelations[];
  if (filters.staleOnly) {
    dealRows = dealRows.filter((d) => isDealStale(d.updated_at));
  }

  const dealIds = dealRows.map((d) => d.id);
  const dealMeta: Record<string, DealMeta> = {};

  if (dealIds.length > 0) {
    const [{ data: stageChanges }, { data: nextTasks }] = await Promise.all([
      supabase
        .from("activities")
        .select("deal_id, created_at")
        .eq("type", "stage_change")
        .in("deal_id", dealIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("deal_id, title, due_at")
        .eq("status", "open")
        .in("deal_id", dealIds)
        .order("due_at", { ascending: true, nullsFirst: false }),
    ]);

    const lastStageChangeAt = new Map<string, string>();
    for (const row of stageChanges ?? []) {
      if (row.deal_id && !lastStageChangeAt.has(row.deal_id)) lastStageChangeAt.set(row.deal_id, row.created_at);
    }

    const nextTaskByDeal = new Map<string, { title: string; due_at: string | null }>();
    for (const row of nextTasks ?? []) {
      if (row.deal_id && !nextTaskByDeal.has(row.deal_id)) nextTaskByDeal.set(row.deal_id, { title: row.title, due_at: row.due_at });
    }

    const now = new Date().getTime();
    for (const deal of dealRows) {
      const since = lastStageChangeAt.get(deal.id) ?? deal.updated_at ?? deal.created_at;
      const daysInStage = Math.max(0, Math.floor((now - new Date(since).getTime()) / (24 * 60 * 60 * 1000)));
      dealMeta[deal.id] = { daysInStage, nextTask: nextTaskByDeal.get(deal.id) ?? null };
    }
  }

  return (
    <div className="flex h-screen flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <PipelineSwitcher pipelines={pipelines ?? []} currentId={pipeline.id} />
          <p className="text-sm text-muted-foreground">{dealRows.length} open deals</p>
        </div>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/pipeline/settings" />}>
          <Settings className="size-4" />
          Settings
        </Button>
      </div>
      <PipelineFilterBar owners={owners} />
      <KanbanBoard pipelineId={pipeline.id} stages={stages ?? []} initialDeals={dealRows} dealMeta={dealMeta} />
    </div>
  );
}
