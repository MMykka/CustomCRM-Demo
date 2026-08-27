"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Pencil, ThumbsDown, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditDealDialog } from "@/components/pipeline/edit-deal-dialog";
import { WonLostDialog } from "@/components/pipeline/won-lost-dialog";
import { contactDisplayName, formatCurrency, type Deal, type Stage } from "@/lib/types";

type HeaderDeal = Deal & {
  contact: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
  company: { id: string; name: string } | null;
  owner: { id: string; full_name: string | null; email: string } | null;
};

export function DealHeader({ deal, stage, pipelineStages }: { deal: HeaderDeal; stage: Stage; pipelineStages: Stage[] }) {
  const [editOpen, setEditOpen] = useState(false);
  const [wonLostMode, setWonLostMode] = useState<"won" | "lost" | null>(null);
  const wonStage = pipelineStages.find((s) => s.is_won);
  const lostStage = pipelineStages.find((s) => s.is_lost);
  const isClosed = deal.status !== "open";

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-start gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{deal.title}</h1>
            <Badge
              variant="outline"
              style={{ borderColor: stage.color, color: stage.color }}
            >
              {stage.name}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="text-base font-semibold text-foreground">{formatCurrency(deal.value, deal.currency)}</span>
            {deal.expected_close_date ? <span>Close {format(new Date(deal.expected_close_date), "MMM d, yyyy")}</span> : null}
            {deal.company ? (
              <span>
                <Link href={`/companies/${deal.company.id}`} className="hover:underline">
                  {deal.company.name}
                </Link>
              </span>
            ) : null}
            {deal.contact ? (
              <span>
                <Link href={`/contacts/${deal.contact.id}`} className="hover:underline">
                  {contactDisplayName(deal.contact)}
                </Link>
              </span>
            ) : null}
            {deal.owner ? <span>Owner: {deal.owner.full_name ?? deal.owner.email}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {!isClosed && wonStage ? (
            <Button variant="outline" size="sm" onClick={() => setWonLostMode("won")}>
              <ThumbsUp className="size-4" />
              Mark won
            </Button>
          ) : null}
          {!isClosed && lostStage ? (
            <Button variant="outline" size="sm" onClick={() => setWonLostMode("lost")}>
              <ThumbsDown className="size-4" />
              Mark lost
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Edit
          </Button>
        </div>
      </div>

      <EditDealDialog deal={deal} open={editOpen} onOpenChange={setEditOpen} />
      {wonLostMode && (wonLostMode === "won" ? wonStage : lostStage) ? (
        <WonLostDialog
          mode={wonLostMode}
          dealId={deal.id}
          defaultValue={deal.value}
          currency={deal.currency}
          stageId={(wonLostMode === "won" ? wonStage : lostStage)!.id}
          open={Boolean(wonLostMode)}
          onOpenChange={(open) => {
            if (!open) setWonLostMode(null);
          }}
        />
      ) : null}
    </div>
  );
}
