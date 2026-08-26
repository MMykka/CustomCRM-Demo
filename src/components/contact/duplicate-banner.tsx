"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MergeContactsDialog } from "@/components/contact/merge-contacts-dialog";
import type { DuplicateCandidate } from "@/lib/actions/duplicates";

export function DuplicateBanner({
  currentContact,
  candidates,
}: {
  currentContact: { id: string; name: string; email: string | null; phone: string | null };
  candidates: DuplicateCandidate[];
}) {
  const [openCandidateId, setOpenCandidateId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (candidates.length === 0 || dismissed) return null;
  const openCandidate = candidates.find((c) => c.id === openCandidateId) ?? null;

  return (
    <>
      <Alert>
        <TriangleAlert />
        <AlertTitle>Possible duplicate{candidates.length > 1 ? "s" : ""} found</AlertTitle>
        <AlertDescription>
          <div className="flex flex-col gap-1.5">
            {candidates.map((candidate) => (
              <div key={candidate.id} className="flex flex-wrap items-center gap-2">
                <span>
                  {candidate.name} — matched on {candidate.matchReason}
                </span>
                <Button variant="outline" size="xs" onClick={() => setOpenCandidateId(candidate.id)}>
                  Review &amp; merge
                </Button>
              </div>
            ))}
          </div>
        </AlertDescription>
        <AlertAction>
          <Button variant="ghost" size="xs" onClick={() => setDismissed(true)}>
            Dismiss
          </Button>
        </AlertAction>
      </Alert>

      {openCandidate ? (
        <MergeContactsDialog
          currentContact={currentContact}
          candidate={openCandidate}
          open={openCandidateId !== null}
          onOpenChange={(open) => setOpenCandidateId(open ? openCandidateId : null)}
        />
      ) : null}
    </>
  );
}
