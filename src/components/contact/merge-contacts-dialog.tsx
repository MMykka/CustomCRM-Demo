"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { mergeContacts, type DuplicateCandidate } from "@/lib/actions/duplicates";

export function MergeContactsDialog({
  currentContact,
  candidate,
  open,
  onOpenChange,
}: {
  currentContact: { id: string; name: string; email: string | null; phone: string | null };
  candidate: DuplicateCandidate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [winner, setWinner] = useState<"current" | "candidate">("current");

  function handleMerge() {
    // mergeContacts() redirects to the winner on success -- don't wrap
    // this in try/catch, since redirect() signals via a thrown error that
    // must propagate (see switchOrganization()/org-switcher.tsx for the
    // same pattern).
    startTransition(() => (winner === "current" ? mergeContacts(currentContact.id, candidate.id) : mergeContacts(candidate.id, currentContact.id)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge duplicate contact</DialogTitle>
          <DialogDescription>
            Matched on {candidate.matchReason}. Deals, tasks, notes, files, and activity from the one you don&apos;t keep will move onto the one you
            keep, and the duplicate will be deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label
            className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm ${winner === "current" ? "border-primary bg-primary/5" : ""}`}
          >
            <span className="flex items-center gap-2">
              <input type="radio" name="merge-winner" checked={winner === "current"} onChange={() => setWinner("current")} />
              <span className="font-medium">Keep {currentContact.name}</span>
            </span>
            <span className="pl-6 text-xs text-muted-foreground">
              {currentContact.email ?? "No email"} · {currentContact.phone ?? "No phone"}
            </span>
          </label>
          <label
            className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-sm ${winner === "candidate" ? "border-primary bg-primary/5" : ""}`}
          >
            <span className="flex items-center gap-2">
              <input type="radio" name="merge-winner" checked={winner === "candidate"} onChange={() => setWinner("candidate")} />
              <span className="font-medium">Keep {candidate.name}</span>
            </span>
            <span className="pl-6 text-xs text-muted-foreground">
              {candidate.email ?? "No email"} · {candidate.phone ?? "No phone"}
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button onClick={handleMerge} disabled={isPending}>
            {isPending ? "Merging..." : "Merge contacts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
