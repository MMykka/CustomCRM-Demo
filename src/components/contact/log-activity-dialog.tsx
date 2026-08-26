"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logCallActivity, logMeetingActivity } from "@/lib/actions/activities";
import type { CallOutcome } from "@/lib/types";

const CALL_OUTCOMES: { value: CallOutcome; label: string }[] = [
  { value: "connected", label: "Connected" },
  { value: "voicemail", label: "Voicemail" },
  { value: "no_answer", label: "No answer" },
  { value: "busy", label: "Busy" },
];

export function LogActivityDialog({
  kind,
  contactId,
  open,
  onOpenChange,
}: {
  kind: "call" | "meeting";
  contactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<CallOutcome>("connected");
  const [duration, setDuration] = useState("");
  const [attendees, setAttendees] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setOutcome("connected");
    setDuration("");
    setAttendees("");
    setNotes("");
  }

  function handleSubmit() {
    startTransition(async () => {
      if (kind === "call") {
        await logCallActivity(contactId, { outcome, durationSeconds: (Number(duration) || 0) * 60, notes });
      } else {
        await logMeetingActivity(contactId, { durationMinutes: Number(duration) || 0, attendees, notes });
      }
      toast.success(kind === "call" ? "Call logged" : "Meeting logged");
      reset();
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "call" ? "Log a call" : "Log a meeting"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {kind === "call" ? (
            <div className="flex flex-col gap-1.5">
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={(value) => setOutcome((value as CallOutcome) ?? "connected")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALL_OUTCOMES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="attendees">Attendees</Label>
              <Input id="attendees" value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="Comma-separated names or emails" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input id="duration" type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="activity-notes">Notes</Label>
            <Textarea id="activity-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
