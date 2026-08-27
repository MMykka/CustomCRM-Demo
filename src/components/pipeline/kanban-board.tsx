"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { moveDealToStage } from "@/lib/actions/pipeline";
import { useHasMounted } from "@/lib/use-has-mounted";
import type { Company, Contact, Deal, Stage } from "@/lib/types";
import { KanbanColumn } from "./kanban-column";
import { DealCard, type DealMeta } from "./deal-card";
import { WonLostDialog } from "./won-lost-dialog";

export type DealWithRelations = Deal & {
  contact: Pick<Contact, "id" | "first_name" | "last_name" | "email"> | null;
  company: Pick<Company, "id" | "name"> | null;
  owner: { id: string; full_name: string | null; email: string } | null;
};

function readCollapsedColumns(pipelineId: string): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(`hub:pipeline:${pipelineId}:collapsedColumns`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function KanbanBoard({
  pipelineId,
  stages,
  initialDeals,
  dealMeta,
}: {
  pipelineId: string;
  stages: Stage[];
  initialDeals: DealWithRelations[];
  dealMeta: Record<string, DealMeta>;
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [syncedInitialDeals, setSyncedInitialDeals] = useState(initialDeals);
  const [activeDeal, setActiveDeal] = useState<DealWithRelations | null>(null);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  const [wonLostPrompt, setWonLostPrompt] = useState<{ dealId: string; mode: "won" | "lost"; stageId: string } | null>(null);
  const [syncedMounted, setSyncedMounted] = useState(false);
  const dealsRef = useRef(deals);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const instanceId = useId();
  const hasMounted = useHasMounted();

  // useState(initialDeals) only seeds state on first mount; a same-route
  // router.refresh() (e.g. after creating a deal elsewhere) re-renders this
  // component with a new initialDeals prop without remounting it, so without
  // this the board would silently keep showing stale data. This is React's
  // documented "adjust state during render" pattern, not a side effect.
  if (initialDeals !== syncedInitialDeals) {
    setSyncedInitialDeals(initialDeals);
    setDeals(initialDeals);
  }

  // Load the persisted collapsed-columns preference once hydration is safe
  // (render-time state adjustment, same idiom as contacts-list.tsx).
  if (hasMounted && !syncedMounted) {
    setSyncedMounted(true);
    setCollapsedColumns(readCollapsedColumns(pipelineId));
  }

  useEffect(() => {
    dealsRef.current = deals;
  }, [deals]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`pipeline-${pipelineId}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals", filter: `pipeline_id=eq.${pipelineId}` },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            setDeals((current) => current.filter((deal) => deal.id !== (payload.old as Deal).id));
            return;
          }

          const updated = payload.new as Deal;

          if (updated.status !== "open") {
            setDeals((current) => current.filter((deal) => deal.id !== updated.id));
            return;
          }

          setDeals((current) => {
            const exists = current.some((deal) => deal.id === updated.id);
            if (exists) {
              return current.map((deal) => (deal.id === updated.id ? { ...deal, ...updated } : deal));
            }
            return current;
          });

          const alreadyHasIt = dealsRef.current.some((deal) => deal.id === updated.id);
          if (!alreadyHasIt) {
            const { data } = await supabase
              .from("deals")
              .select("*, contact:contacts(id, first_name, last_name, email), company:companies(id, name), owner:users(id, full_name, email)")
              .eq("id", updated.id)
              .single();
            if (data) {
              setDeals((current) => (current.some((deal) => deal.id === data.id) ? current : [data, ...current]));
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pipelineId, instanceId]);

  function toggleColumnCollapse(stageId: string) {
    const next = { ...collapsedColumns, [stageId]: !collapsedColumns[stageId] };
    setCollapsedColumns(next);
    try {
      window.localStorage.setItem(`hub:pipeline:${pipelineId}:collapsedColumns`, JSON.stringify(next));
    } catch {
      // ignore unavailable localStorage
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDeal((event.active.data.current?.deal as DealWithRelations | undefined) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDeal(null);

    const dealId = event.active.id as string;
    const toStageId = event.over?.id as string | undefined;
    if (!toStageId) return;

    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === toStageId) return;

    // Dropping onto a won/lost stage opens the Won/Lost dialog instead of
    // moving the deal directly -- no optimistic update happens here, so the
    // card visually snaps back to its column if the dialog is cancelled.
    const targetStage = stages.find((s) => s.id === toStageId);
    if (targetStage?.is_won || targetStage?.is_lost) {
      setWonLostPrompt({ dealId, mode: targetStage.is_won ? "won" : "lost", stageId: toStageId });
      return;
    }

    const previousStageId = deal.stage_id;
    setDeals((current) => current.map((d) => (d.id === dealId ? { ...d, stage_id: toStageId } : d)));

    try {
      await moveDealToStage(dealId, toStageId);
    } catch {
      setDeals((current) => current.map((d) => (d.id === dealId ? { ...d, stage_id: previousStageId } : d)));
      toast.error("Couldn't move deal. Try again.");
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDeal(null)}>
      <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={deals.filter((deal) => deal.stage_id === stage.id)}
            dealMeta={dealMeta}
            collapsed={collapsedColumns[stage.id] ?? false}
            onToggleCollapse={() => toggleColumnCollapse(stage.id)}
          />
        ))}
      </div>
      <DragOverlay>{activeDeal ? <DealCard deal={activeDeal} isOverlay /> : null}</DragOverlay>

      {wonLostPrompt ? (
        <WonLostDialog
          mode={wonLostPrompt.mode}
          dealId={wonLostPrompt.dealId}
          defaultValue={deals.find((d) => d.id === wonLostPrompt.dealId)?.value ?? 0}
          currency={deals.find((d) => d.id === wonLostPrompt.dealId)?.currency ?? "USD"}
          stageId={wonLostPrompt.stageId}
          open={Boolean(wonLostPrompt)}
          onOpenChange={(open) => {
            if (!open) setWonLostPrompt(null);
          }}
          navigateToDealOnSuccess
        />
      ) : null}
    </DndContext>
  );
}
