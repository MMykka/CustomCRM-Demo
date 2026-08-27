"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { markDealLost, markDealWon } from "@/lib/actions/pipeline";
import { DEAL_LOST_REASONS, DEAL_WON_REASONS } from "@/lib/types";

export function WonLostDialog({
  mode,
  dealId,
  defaultValue,
  currency,
  stageId,
  open,
  onOpenChange,
}: {
  mode: "won" | "lost";
  dealId: string;
  defaultValue: number;
  currency: string;
  stageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reasons = mode === "won" ? DEAL_WON_REASONS : DEAL_LOST_REASONS;
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState<string>(reasons[0]);
  const [otherReason, setOtherReason] = useState("");
  const [finalValue, setFinalValue] = useState(String(defaultValue));
  const [syncedOpen, setSyncedOpen] = useState(open);
  const router = useRouter();

  // Reset local form state on the render where the dialog transitions
  // closed -> open (React's "adjust state during render" pattern, matching
  // edit-deal-dialog.tsx).
  if (open && !syncedOpen) {
    setReason(reasons[0]);
    setOtherReason("");
    setFinalValue(String(defaultValue));
  }
  if (open !== syncedOpen) {
    setSyncedOpen(open);
  }

  function handleSubmit() {
    const resolvedReason = reason === "Other" ? otherReason.trim() : reason;
    if (!resolvedReason) return;

    startTransition(async () => {
      if (mode === "won") {
        await markDealWon(dealId, { finalValue: Number(finalValue) || 0, reason: resolvedReason, stageId });
        toast.success("Deal marked won");
      } else {
        await markDealLost(dealId, { reason: resolvedReason, stageId });
        toast.success("Deal marked lost");
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "won" ? "Mark deal won" : "Mark deal lost"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {mode === "won" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="finalValue">Final value ({currency})</Label>
              <Input id="finalValue" type="number" min="0" step="1" value={finalValue} onChange={(e) => setFinalValue(e.target.value)} autoFocus />
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(value) => setReason(value ?? reasons[0])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {reason === "Other" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="otherReason">Details</Label>
              <Input id="otherReason" value={otherReason} onChange={(e) => setOtherReason(e.target.value)} autoFocus={mode === "lost"} />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || (reason === "Other" && !otherReason.trim())}>
            {isPending ? "Saving..." : mode === "won" ? "Mark won" : "Mark lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
