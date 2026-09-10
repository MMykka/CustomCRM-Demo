"use client";

import { useActionState, useState } from "react";
import { updateOrgProfile, type BusinessHours } from "@/lib/actions/organizations";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function HoursEditor({ value, onChange }: { value: BusinessHours; onChange: (next: BusinessHours) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      {DAYS.map((day) => {
        const range = value[day.key] ?? null;
        return (
          <div key={day.key} className="flex items-center gap-2 text-sm">
            <Switch
              size="sm"
              checked={range !== null}
              onCheckedChange={(checked) =>
                onChange({ ...value, [day.key]: checked ? { start: "09:00", end: "17:00" } : null })
              }
            />
            <span className="w-9 text-muted-foreground">{day.label}</span>
            {range ? (
              <>
                <input
                  type="time"
                  value={range.start}
                  onChange={(e) => onChange({ ...value, [day.key]: { ...range, start: e.target.value } })}
                  className="rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="time"
                  value={range.end}
                  onChange={(e) => onChange({ ...value, [day.key]: { ...range, end: e.target.value } })}
                  className="rounded-md border border-input bg-transparent px-1.5 py-0.5 text-xs"
                />
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Off</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function OrgProfileForm({
  timezone: initialTimezone,
  businessHours: initialBusinessHours,
  quietHours: initialQuietHours,
}: {
  timezone: string;
  businessHours: BusinessHours | null;
  quietHours: BusinessHours | null;
}) {
  const [state, formAction, pending] = useActionState(updateOrgProfile, { error: null });
  const [timezone, setTimezone] = useState(initialTimezone);
  const [businessHours, setBusinessHours] = useState<BusinessHours>(initialBusinessHours ?? {});
  const [quietHours, setQuietHours] = useState<BusinessHours>(initialQuietHours ?? {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="timezone" value={timezone} />
      <input type="hidden" name="businessHours" value={JSON.stringify(businessHours)} />
      <input type="hidden" name="quietHours" value={JSON.stringify(quietHours)} />

      <div className="flex flex-col gap-1.5">
        <Label>Timezone</Label>
        <Select value={timezone} onValueChange={(v) => v && setTimezone(v)} items={TIMEZONES.map((tz) => ({ value: tz, label: tz }))}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Business hours</Label>
        <HoursEditor value={businessHours} onChange={setBusinessHours} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Quiet hours</Label>
        <p className="text-xs text-muted-foreground">No outbound messages or calls should be scheduled during these windows.</p>
        <HoursEditor value={quietHours} onChange={setQuietHours} />
      </div>

      {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      <Button type="submit" size="sm" className="w-fit" disabled={pending}>
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
