"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  const [focusedDealId, setFocusedDealId] = useState<string | null>(null);
  const dealsRef = useRef(deals);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const instanceId = useId();
  const hasMounted = useHasMounted();
  const router = useRouter();

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

          // Deals only leave the board entirely when they're closed AND old
          // enough to fall outside the server query's recent-closed window
          // (see pipeline/page.tsx) -- a realtime update alone can't know
          // that cutoff, so a deal freshly marked won/lost is updated in
          // place like any other field change instead of being removed;
          // it'll simply drop off on the next full page load once it ages out.
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

  // Arrow-key navigation between deal cards, Enter to open the focused deal,
  // Escape to clear focus. Ignored while typing in a field or while a dialog
  // (e.g. Won/Lost) is open so it doesn't fight with normal text input.
  useEffect(() => {
    function visibleStages() {
      return stages.filter((s) => !collapsedColumns[s.id]);
    }
    function dealsInStage(stageId: string) {
      return deals.filter((d) => d.stage_id === stageId);
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (wonLostPrompt || target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter", "Escape"].includes(event.key)) return;

      if (event.key === "Escape") {
        setFocusedDealId(null);
        return;
      }

      if (event.key === "Enter") {
        if (focusedDealId) {
          event.preventDefault();
          router.push(`/pipeline/${focusedDealId}`);
        }
        return;
      }

      const visible = visibleStages();
      if (visible.length === 0) return;

      const currentDeal = focusedDealId ? deals.find((d) => d.id === focusedDealId) : undefined;
      const currentStageIndex = currentDeal ? visible.findIndex((s) => s.id === currentDeal.stage_id) : -1;

      if (currentStageIndex === -1) {
        // Nothing focused yet -- jump into the first deal of the first non-empty column.
        const firstStageWithDeals = visible.find((s) => dealsInStage(s.id).length > 0);
        if (firstStageWithDeals) {
          event.preventDefault();
          setFocusedDealId(dealsInStage(firstStageWithDeals.id)[0].id);
        }
        return;
      }

      const columnDeals = dealsInStage(currentDeal!.stage_id);
      const indexInColumn = columnDeals.findIndex((d) => d.id === currentDeal!.id);

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const nextIndex = event.key === "ArrowDown" ? indexInColumn + 1 : indexInColumn - 1;
        if (nextIndex >= 0 && nextIndex < columnDeals.length) {
          setFocusedDealId(columnDeals[nextIndex].id);
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const step = event.key === "ArrowRight" ? 1 : -1;
        for (let i = currentStageIndex + step; i >= 0 && i < visible.length; i += step) {
          const candidateDeals = dealsInStage(visible[i].id);
          if (candidateDeals.length > 0) {
            setFocusedDealId(candidateDeals[Math.min(indexInColumn, candidateDeals.length - 1)].id);
            return;
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stages, deals, collapsedColumns, focusedDealId, wonLostPrompt, router]);

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
            focusedDealId={focusedDealId}
            onFocusDeal={setFocusedDealId}
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
