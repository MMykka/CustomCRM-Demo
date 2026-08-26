"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { enrollContactInSequence, pauseSequenceEnrollment, removeSequenceEnrollment, resumeSequenceEnrollment } from "@/lib/actions/sequences";
import type { SequenceEnrollment } from "@/lib/types";

export type EnrollmentWithSequence = SequenceEnrollment & { sequence: { id: string; name: string } | null };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  paused: "secondary",
  completed: "outline",
  exited: "outline",
};

export function SequenceEnrollmentsPanel({
  contactId,
  enrollments,
  availableSequences,
}: {
  contactId: string;
  enrollments: EnrollmentWithSequence[];
  availableSequences: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [sequenceId, setSequenceId] = useState("");

  function enroll() {
    if (!sequenceId) return;
    startTransition(async () => {
      try {
        await enrollContactInSequence(contactId, sequenceId);
        setSequenceId("");
      } catch {
        toast.error("Couldn't enroll — contact may already be active in this sequence");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {enrollments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not enrolled in any sequence.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {enrollments.map((enrollment) => (
            <li key={enrollment.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{enrollment.sequence?.name ?? "Unknown sequence"}</p>
                <p className="text-xs text-muted-foreground">Step {enrollment.current_step}</p>
              </div>
              <Badge variant={STATUS_VARIANT[enrollment.status] ?? "outline"} className="capitalize">
                {enrollment.status}
              </Badge>
              {enrollment.status === "active" || enrollment.status === "paused" ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(() =>
                        enrollment.status === "active"
                          ? pauseSequenceEnrollment(enrollment.id, contactId)
                          : resumeSequenceEnrollment(enrollment.id, contactId),
                      )
                    }
                    title={enrollment.status === "active" ? "Pause" : "Resume"}
                  >
                    {enrollment.status === "active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={isPending}
                    onClick={() => startTransition(() => removeSequenceEnrollment(enrollment.id, contactId))}
                    title="Remove"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {availableSequences.length > 0 ? (
        <div className="flex gap-2">
          <Select value={sequenceId} onValueChange={(value) => setSequenceId(value ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Enroll in a sequence..." />
            </SelectTrigger>
            <SelectContent>
              {availableSequences.map((seq) => (
                <SelectItem key={seq.id} value={seq.id}>
                  {seq.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={enroll} disabled={!sequenceId || isPending}>
            Enroll
          </Button>
        </div>
      ) : null}
    </div>
  );
}
