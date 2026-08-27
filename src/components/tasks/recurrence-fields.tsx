"use client";

import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RecurrenceUnit } from "@/lib/types";

export const RECURRENCE_UNIT_OPTIONS: { value: RecurrenceUnit; label: string }[] = [
  { value: "day", label: "day(s)" },
  { value: "week", label: "week(s)" },
  { value: "month", label: "month(s)" },
];

export function RecurrenceFields({
  enabled,
  onEnabledChange,
  interval,
  onIntervalChange,
  unit,
  onUnitChange,
}: {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  interval: number;
  onIntervalChange: (interval: number) => void;
  unit: RecurrenceUnit;
  onUnitChange: (unit: RecurrenceUnit) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
        Repeat
        <Switch checked={enabled} onCheckedChange={(checked) => onEnabledChange(checked === true)} />
      </label>
      {enabled ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Every</span>
          <Input
            type="number"
            min="1"
            value={interval}
            onChange={(e) => onIntervalChange(Math.max(1, Number(e.target.value) || 1))}
            className="w-16"
          />
          <Select value={unit} onValueChange={(value) => onUnitChange((value as RecurrenceUnit) ?? "week")} items={RECURRENCE_UNIT_OPTIONS}>
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECURRENCE_UNIT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
