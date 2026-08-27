"use client";

import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/types";
import type { Stage } from "@/lib/types";
import { DealCard, type DealMeta } from "./deal-card";
import type { DealWithRelations } from "./kanban-board";

export function KanbanColumn({
  stage,
  deals,
  dealMeta,
  collapsed,
  onToggleCollapse,
}: {
  stage: Stage;
  deals: DealWithRelations[];
  dealMeta: Record<string, DealMeta>;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  // The droppable ref always stays on a rendered, mounted node -- even
  // collapsed -- so a deal can still be dropped into a collapsed column
  // without expanding it first.
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((sum, deal) => sum + deal.value, 0);
  const weighted = deals.reduce((sum, deal) => sum + (deal.value * stage.probability) / 100, 0);

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        className={`flex w-12 shrink-0 flex-col items-center gap-2 rounded-lg border bg-muted/30 py-3 transition-colors ${isOver ? "bg-accent/50" : ""}`}
        style={{ borderTopColor: stage.color, borderTopWidth: 2 }}
      >
        <button type="button" onClick={onToggleCollapse} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ChevronRight className="size-4" />
        </button>
        <span className="whitespace-nowrap text-xs font-medium [writing-mode:vertical-rl]">
          {stage.name} · {deals.length}
        </span>
      </div>
    );
  }

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5" style={{ borderTopColor: stage.color, borderTopWidth: 2 }}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{stage.name}</p>
          <p className="text-xs text-muted-foreground">
            {deals.length} · {formatCurrency(total, "USD")}
          </p>
          {stage.probability > 0 ? <p className="text-[11px] text-muted-foreground">Weighted {formatCurrency(weighted, "USD")}</p> : null}
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div ref={setNodeRef} className={`flex min-h-24 flex-col gap-2 p-2 transition-colors ${isOver ? "bg-accent/50" : ""}`}>
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} meta={dealMeta[deal.id]} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
