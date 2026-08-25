"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { moveDealToStage } from "@/lib/actions/pipeline";
import type { Contact, Deal, Stage } from "@/lib/types";
import { KanbanColumn } from "./kanban-column";

export type DealWithRelations = Deal & {
  contact: Pick<Contact, "id" | "first_name" | "last_name" | "email"> | null;
  owner: { id: string; full_name: string | null; email: string } | null;
};

export function KanbanBoard({
  pipelineId,
  stages,
  initialDeals,
}: {
  pipelineId: string;
  stages: Stage[];
  initialDeals: DealWithRelations[];
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [syncedInitialDeals, setSyncedInitialDeals] = useState(initialDeals);
  const dealsRef = useRef(deals);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const instanceId = useId();

  // useState(initialDeals) only seeds state on first mount; a same-route
  // router.refresh() (e.g. after creating a deal elsewhere) re-renders this
  // component with a new initialDeals prop without remounting it, so without
  // this the board would silently keep showing stale data. This is React's
  // documented "adjust state during render" pattern, not a side effect.
  if (initialDeals !== syncedInitialDeals) {
    setSyncedInitialDeals(initialDeals);
    setDeals(initialDeals);
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
              .select("*, contact:contacts(id, first_name, last_name, email), owner:users(id, full_name, email)")
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

  async function handleDragEnd(event: DragEndEvent) {
    const dealId = event.active.id as string;
    const toStageId = event.over?.id as string | undefined;
    if (!toStageId) return;

    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === toStageId) return;

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
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <KanbanColumn key={stage.id} stage={stage} deals={deals.filter((deal) => deal.stage_id === stage.id)} />
        ))}
      </div>
    </DndContext>
  );
}
