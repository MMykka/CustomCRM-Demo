import Link from "next/link";
import { Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { KanbanBoard, type DealWithRelations } from "@/components/pipeline/kanban-board";
import { PipelineSwitcher } from "@/components/pipeline/pipeline-switcher";
import { PipelineFilterBar } from "@/components/pipeline/pipeline-filter-bar";
import { ViewToggle } from "@/components/pipeline/view-toggle";
import { DealsList } from "@/components/pipeline/deals-list";
import type { DealRow } from "@/components/pipeline/deals-table";
import { listOrgMembersForPicker } from "@/lib/actions/organizations";
import { listSavedViews } from "@/lib/actions/saved-views";
import { isDealStale, parsePipelineFilters } from "@/lib/pipeline-filters";
import { parseDealsFilters, queryDeals, DEALS_PAGE_SIZE } from "@/lib/deals-query";
import type { DealMeta } from "@/components/pipeline/deal-card";
import type { FilterOption } from "@/components/contacts/multi-select-filter";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const appUser = await requireAppUser();
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const view = resolvedSearchParams.view === "list" ? "list" : "kanban";

  const { data: pipelines } = await supabase
    .from("pipelines")
    .select("*")
    .eq("organization_id", appUser.organization_id!)
    .order("is_default", { ascending: false })
    .order("position");

  if (!pipelines || pipelines.length === 0) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">No pipeline found yet.</p>
      </div>
    );
  }

  const settingsButton = (
    <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/pipeline/settings" />}>
      <Settings className="size-4" />
      Settings
    </Button>
  );

  if (view === "list") {
    const dealsFilters = parseDealsFilters(resolvedSearchParams);
    const [{ rows, totalCount }, owners, savedViews, { data: allStages }, { data: userData }] = await Promise.all([
      queryDeals(supabase, dealsFilters),
      listOrgMembersForPicker(),
      listSavedViews("deal"),
      supabase
        .from("stages")
        .select("*, pipeline:pipelines(id, name)")
        .in(
          "pipeline_id",
          pipelines.map((p) => p.id),
        )
        .order("pipeline_id")
        .order("position"),
      supabase.auth.getUser(),
    ]);

    const stageOptions: FilterOption[] = (allStages ?? []).map((s) => ({
      value: s.id,
      label: `${s.pipeline?.name ?? ""} — ${s.name}`,
      color: s.color,
    }));
    const stagesForBulk = (allStages ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      pipeline_name: s.pipeline?.name ?? "",
      is_won: s.is_won,
      is_lost: s.is_lost,
    }));

    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
            <p className="text-sm text-muted-foreground">{totalCount} deals</p>
          </div>
          <div className="flex items-center gap-2">
            <ViewToggle view="list" />
            {settingsButton}
          </div>
        </div>
        <DealsList
          rows={rows as DealRow[]}
          totalCount={totalCount}
          page={dealsFilters.page}
          pageSize={DEALS_PAGE_SIZE}
          owners={owners}
          stageOptions={stageOptions}
          stages={stagesForBulk}
          savedViews={savedViews}
          currentUserId={userData?.user?.id ?? ""}
        />
      </div>
    );
  }

  const filters = parsePipelineFilters(resolvedSearchParams);
  const requestedPipelineId = Array.isArray(resolvedSearchParams.pipeline) ? resolvedSearchParams.pipeline[0] : resolvedSearchParams.pipeline;
  const pipeline = pipelines.find((p) => p.id === requestedPipelineId) ?? pipelines[0]!;

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
          <PipelineSwitcher pipelines={pipelines} currentId={pipeline.id} />
          <p className="text-sm text-muted-foreground">{dealRows.length} open deals</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle view="kanban" />
          {settingsButton}
        </div>
      </div>
      <PipelineFilterBar owners={owners} />
      <KanbanBoard pipelineId={pipeline.id} stages={stages ?? []} initialDeals={dealRows} dealMeta={dealMeta} />
    </div>
  );
}
