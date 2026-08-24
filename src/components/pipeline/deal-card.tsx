"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { contactDisplayName, formatCurrency, initialsFor } from "@/lib/types";
import type { DealWithRelations } from "./kanban-board";

export function DealCard({ deal }: { deal: DealWithRelations }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
  });

  const ownerName = deal.owner?.full_name ?? deal.owner?.email ?? null;

  return (
    <Card
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`cursor-grab touch-none gap-2 py-3 active:cursor-grabbing ${isDragging ? "opacity-50" : ""}`}
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
