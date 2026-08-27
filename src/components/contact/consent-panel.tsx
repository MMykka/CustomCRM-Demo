"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateConsent } from "@/lib/actions/consent";
import type { ConsentStatus } from "@/lib/types";

const CONSENT_LABELS: Record<ConsentStatus, string> = {
  unknown: "Unknown",
  granted: "Granted",
  revoked: "Revoked",
};

export function ConsentPanel({
  contactId,
  consentStatus,
  emailOptOut,
  smsOptOut,
  consentUpdatedAt,
}: {
  contactId: string;
  consentStatus: ConsentStatus;
  emailOptOut: boolean;
  smsOptOut: boolean;
  consentUpdatedAt: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(consentStatus);
  const [emailOut, setEmailOut] = useState(emailOptOut);
  const [smsOut, setSmsOut] = useState(smsOptOut);

  function save(next: { consentStatus?: ConsentStatus; emailOptOut?: boolean; smsOptOut?: boolean }) {
    const nextStatus = next.consentStatus ?? status;
    const nextEmailOut = next.emailOptOut ?? emailOut;
    const nextSmsOut = next.smsOptOut ?? smsOut;
    setStatus(nextStatus);
    setEmailOut(nextEmailOut);
    setSmsOut(nextSmsOut);
    startTransition(() => updateConsent(contactId, { consentStatus: nextStatus, emailOptOut: nextEmailOut, smsOptOut: nextSmsOut }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Consent status</Label>
        <Select
          value={status}
          onValueChange={(value) => save({ consentStatus: (value as ConsentStatus) ?? "unknown" })}
          disabled={isPending}
          items={(Object.entries(CONSENT_LABELS) as [ConsentStatus, string][]).map(([value, label]) => ({ value, label }))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(CONSENT_LABELS) as [ConsentStatus, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center justify-between gap-2 text-sm">
        Opted out of email
        <Switch checked={emailOut} onCheckedChange={(checked) => save({ emailOptOut: checked === true })} disabled={isPending} />
      </label>

      <label className="flex items-center justify-between gap-2 text-sm">
        Opted out of SMS
        <Switch checked={smsOut} onCheckedChange={(checked) => save({ smsOptOut: checked === true })} disabled={isPending} />
      </label>

      {consentUpdatedAt ? (
        <p className="text-xs text-muted-foreground">Updated {formatDistanceToNow(new Date(consentUpdatedAt), { addSuffix: true })}</p>
      ) : null}
    </div>
  );
}
