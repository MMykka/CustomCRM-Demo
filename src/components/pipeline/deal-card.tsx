"use client";

import { useDraggable } from "@dnd-kit/core";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { contactDisplayName, formatCurrency, initialsFor } from "@/lib/types";
import { isDealStale } from "@/lib/pipeline-filters";
import type { DealWithRelations } from "./kanban-board";

export type DealMeta = { daysInStage: number; nextTask: { title: string; due_at: string | null } | null };

export function DealCard({ deal, meta, isOverlay = false }: { deal: DealWithRelations; meta?: DealMeta; isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
    disabled: isOverlay,
  });

  const ownerName = deal.owner?.full_name ?? deal.owner?.email ?? null;
  const stale = !isOverlay && isDealStale(deal.updated_at);

  return (
    <Card
      ref={isOverlay ? undefined : setNodeRef}
      {...(isOverlay ? {} : listeners)}
      {...(isOverlay ? {} : attributes)}
      className={`touch-none gap-1.5 py-3 ${stale ? "border-l-2 border-l-brand-yellow-foreground" : ""} ${
        isOverlay ? "w-64 cursor-grabbing shadow-lg" : `cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`
      }`}
    >
      <CardContent className="flex flex-col gap-1.5 px-3">
        <p className="text-sm font-medium leading-tight">{deal.title}</p>
        {deal.company ? <p className="text-xs text-muted-foreground">{deal.company.name}</p> : null}
        {deal.contact ? <p className="text-xs text-muted-foreground">{contactDisplayName(deal.contact)}</p> : null}

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{formatCurrency(deal.value, deal.currency)}</span>
          {ownerName ? (
            <Avatar className="size-6" title={ownerName}>
              <AvatarFallback className="text-[10px]">{initialsFor(ownerName)}</AvatarFallback>
            </Avatar>
          ) : null}
        </div>

        {deal.expected_close_date ? (
          <p className="text-[11px] text-muted-foreground">Close {format(new Date(deal.expected_close_date), "MMM d")}</p>
        ) : null}

        {meta ? (
          <div className="flex flex-col gap-0.5 border-t pt-1.5 text-[11px] text-muted-foreground">
            <span>{meta.daysInStage}d in stage</span>
            {meta.nextTask ? (
              <span className="truncate">
                Next: {meta.nextTask.title}
                {meta.nextTask.due_at ? ` · ${format(new Date(meta.nextTask.due_at), "MMM d")}` : ""}
              </span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
