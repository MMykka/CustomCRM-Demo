"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { logOutboundMessage } from "@/lib/actions/messages";

// No telephony/SMS/email-sending integration exists in this app, so this
// both fires a real mailto:/sms: link (so it actually opens the user's
// client) and logs the outbound message so it's not lost -- it'll show up
// once the unified timeline (merging activities + messages) lands.
export function LogMessageDialog({
  channel,
  contactId,
  toAddress,
  open,
  onOpenChange,
}: {
  channel: "sms" | "email";
  contactId: string;
  toAddress: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  function reset() {
    setSubject("");
    setBody("");
  }

  function handleSubmit() {
    if (!body.trim()) return;
    startTransition(async () => {
      await logOutboundMessage(contactId, { channel, toAddress, subject: channel === "email" ? subject : undefined, body });

      if (toAddress) {
        if (channel === "email") {
          window.location.href = `mailto:${toAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        } else {
          window.location.href = `sms:${toAddress}?&body=${encodeURIComponent(body)}`;
        }
      }

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
          <DialogTitle>{channel === "email" ? "Send email" : "Send text"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {channel === "email" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="msg-subject">Subject</Label>
              <Input id="msg-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="msg-body">Message</Label>
            <Textarea id="msg-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>
          {!toAddress ? (
            <p className="text-xs text-destructive">
              This contact has no {channel === "email" ? "email address" : "phone number"} on file — this will be logged but won&apos;t open your{" "}
              {channel === "email" ? "mail client" : "messaging app"}.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending || !body.trim()}>
            {isPending ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
