"use client";

import { useDraggable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { contactDisplayName, formatCurrency, initialsFor } from "@/lib/types";
import type { DealWithRelations } from "./kanban-board";

export function DealCard({ deal, isOverlay = false }: { deal: DealWithRelations; isOverlay?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
    disabled: isOverlay,
  });

  const ownerName = deal.owner?.full_name ?? deal.owner?.email ?? null;

  return (
    <Card
      ref={isOverlay ? undefined : setNodeRef}
      {...(isOverlay ? {} : listeners)}
      {...(isOverlay ? {} : attributes)}
      className={`touch-none gap-2 py-3 ${
        isOverlay ? "w-64 cursor-grabbing shadow-lg" : `cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`
      }`}
    >
      <CardContent className="flex flex-col gap-2 px-3">
        <p className="text-sm font-medium leading-tight">{deal.title}</p>
        {deal.contact ? <p className="text-xs text-muted-foreground">{contactDisplayName(deal.contact)}</p> : null}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{formatCurrency(deal.value, deal.currency)}</span>
          {ownerName ? (
            <Avatar className="size-6" title={ownerName}>
              <AvatarFallback className="text-[10px]">{initialsFor(ownerName)}</AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
