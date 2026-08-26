"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export type FilterOption = { value: string; label: string; color?: string };

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            {label}
            {selected.length ? ` (${selected.length})` : ""}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-56 p-2">
        <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {options.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No options</p>
          ) : (
            options.map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                <Checkbox checked={selected.includes(opt.value)} onCheckedChange={() => toggle(opt.value)} />
                {opt.color ? <span className="size-2 rounded-full" style={{ backgroundColor: opt.color }} /> : null}
                {opt.label}
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
