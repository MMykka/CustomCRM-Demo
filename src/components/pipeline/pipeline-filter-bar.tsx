"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MultiSelectFilter } from "@/components/contacts/multi-select-filter";

export function PipelineFilterBar({ owners }: { owners: { id: string; full_name: string | null; email: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const valueMinParam = searchParams.get("value_min") ?? "";
  const valueMaxParam = searchParams.get("value_max") ?? "";
  const [valueMin, setValueMin] = useState(valueMinParam);
  const [syncedValueMin, setSyncedValueMin] = useState(valueMinParam);
  const [valueMax, setValueMax] = useState(valueMaxParam);
  const [syncedValueMax, setSyncedValueMax] = useState(valueMaxParam);

  // PipelineFilterBar never unmounts across filter changes, so a plain
  // defaultValue would go stale (and Base UI warns about mutating it post-
  // init) whenever the URL param changes from elsewhere, e.g. Clear.
  if (valueMinParam !== syncedValueMin) {
    setSyncedValueMin(valueMinParam);
    setValueMin(valueMinParam);
  }
  if (valueMaxParam !== syncedValueMax) {
    setSyncedValueMax(valueMaxParam);
    setValueMax(valueMaxParam);
  }

  // /pipeline is always visible (and prefetched) in the sidebar nav, which
  // means a plain router.replace() can serve a stale cached RSC payload
  // instead of refetching with the new search params -- router.refresh()
  // forces the fresh fetch. Same class of bug as documented for the
  // contacts list; the difference there is ContactsTable has no local
  // state to mask it, while KanbanBoard's synced-prop state can otherwise
  // keep rendering the stale deals.
  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(`/pipeline?${params.toString()}`);
    router.refresh();
  }

  function clearFilters() {
    const params = new URLSearchParams();
    const pipeline = searchParams.get("pipeline");
    if (pipeline) params.set("pipeline", pipeline);
    router.replace(`/pipeline${params.toString() ? `?${params.toString()}` : ""}`);
    router.refresh();
  }

  const ownerIds = searchParams.get("owner")?.split(",").filter(Boolean) ?? [];
  const staleOnly = searchParams.get("stale") === "1";
  const hasFilters = ownerIds.length > 0 || Boolean(searchParams.get("value_min")) || Boolean(searchParams.get("value_max")) || staleOnly;

  const ownerOptions = owners.map((o) => ({ value: o.id, label: o.full_name ?? o.email }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelectFilter
        label="Owner"
        options={ownerOptions}
        selected={ownerIds}
        onChange={(next) => updateParams({ owner: next.length ? next.join(",") : null })}
      />

      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm">
              Value
            </Button>
          }
        />
        <PopoverContent align="start" className="w-64 p-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Min</label>
              <Input
                type="number"
                value={valueMin}
                onChange={(e) => {
                  setValueMin(e.target.value);
                  updateParams({ value_min: e.target.value || null });
                }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Max</label>
              <Input
                type="number"
                value={valueMax}
                onChange={(e) => {
                  setValueMax(e.target.value);
                  updateParams({ value_max: e.target.value || null });
                }}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button variant={staleOnly ? "secondary" : "outline"} size="sm" onClick={() => updateParams({ stale: staleOnly ? null : "1" })}>
        <AlertTriangle className="size-4" />
        Stale
      </Button>

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="size-4" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
