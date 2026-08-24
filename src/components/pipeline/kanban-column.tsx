"use client";

import { useDroppable } from "@dnd-kit/core";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/types";
import type { Stage } from "@/lib/types";
import { DealCard } from "./deal-card";
import type { DealWithRelations } from "./kanban-board";

export function KanbanColumn({ stage, deals }: { stage: Stage; deals: DealWithRelations[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((sum, deal) => sum + deal.value, 0);

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between border-b px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">{stage.name}</p>
          <p className="text-xs text-muted-foreground">
            {deals.length} · {formatCurrency(total, "USD")}
          </p>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div ref={setNodeRef} className={`flex min-h-24 flex-col gap-2 p-2 transition-colors ${isOver ? "bg-accent/50" : ""}`}>
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
