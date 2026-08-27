"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Download, Search, SlidersHorizontal, X, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectFilter, type FilterOption } from "@/components/contacts/multi-select-filter";
import { SavedViewsMenu } from "@/components/contacts/saved-views-menu";
import { DEAL_COLUMN_OPTIONS } from "@/components/pipeline/deal-columns";
import { exportDealsForFilters } from "@/lib/actions/deals-bulk";
import { downloadCsv } from "@/lib/csv";
import type { SavedView } from "@/lib/types";
import type { VisibilityState } from "@tanstack/react-table";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "value_desc", label: "Value: high to low" },
  { value: "value_asc", label: "Value: low to high" },
  { value: "close_date_asc", label: "Close date: soonest" },
  { value: "close_date_desc", label: "Close date: latest" },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "all", label: "All" },
];

export function DealsToolbar({
  owners,
  stageOptions,
  savedViews,
  currentUserId,
  columnVisibility,
  onColumnVisibilityChange,
}: {
  owners: { id: string; full_name: string | null; email: string }[];
  stageOptions: FilterOption[];
  savedViews: SavedView[];
  currentUserId: string;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (next: VisibilityState) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const [isExporting, startExport] = useTransition();

  function exportAll() {
    startExport(async () => {
      const rows = await exportDealsForFilters(Object.fromEntries(searchParams.entries()));
      if (rows.length === 0) {
        toast.error("No deals match the current filters");
        return;
      }
      downloadCsv(`deals-export-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    });
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== (searchParams.get("q") ?? "")) updateParams({ q: searchInput || null });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    if (!("page" in patch)) params.delete("page");
    router.replace(`/pipeline${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function toggleColumn(id: string) {
    onColumnVisibilityChange({ ...columnVisibility, [id]: !(columnVisibility[id] ?? true) });
  }

  const ownerOptions: FilterOption[] = owners.map((o) => ({ value: o.id, label: o.full_name ?? o.email }));

  const activeFilterCount = ["stage", "owner", "value_min", "value_max", "from", "to", "stale"].filter((k) => searchParams.get(k)).length;
  const sort = searchParams.get("sort") ?? "created_desc";
  const status = searchParams.get("status") ?? "open";
  const staleOnly = searchParams.get("stale") === "1";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search deals..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-8" />
        </div>

        <MultiSelectFilter
          label="Stage"
          options={stageOptions}
          selected={searchParams.get("stage")?.split(",").filter(Boolean) ?? []}
          onChange={(next) => updateParams({ stage: next.length ? next.join(",") : null })}
        />
        <MultiSelectFilter
          label="Owner"
          options={ownerOptions}
          selected={searchParams.get("owner")?.split(",").filter(Boolean) ?? []}
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
                <Input type="number" defaultValue={searchParams.get("value_min") ?? ""} onChange={(e) => updateParams({ value_min: e.target.value || null })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Max</label>
                <Input type="number" defaultValue={searchParams.get("value_max") ?? ""} onChange={(e) => updateParams({ value_max: e.target.value || null })} />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm">
                Close date
              </Button>
            }
          />
          <PopoverContent align="start" className="w-64 p-3">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">From</label>
                <Input type="date" defaultValue={searchParams.get("from") ?? ""} onChange={(e) => updateParams({ from: e.target.value || null })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">To</label>
                <Input type="date" defaultValue={searchParams.get("to") ?? ""} onChange={(e) => updateParams({ to: e.target.value || null })} />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button variant={staleOnly ? "secondary" : "outline"} size="sm" onClick={() => updateParams({ stale: staleOnly ? null : "1" })}>
          <AlertTriangle className="size-4" />
          Stale
        </Button>

        <Select value={status} onValueChange={(value) => updateParams({ status: value === "open" ? null : value })} items={STATUS_OPTIONS}>
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeFilterCount > 0 || searchInput ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput("");
              router.replace("/pipeline?view=list");
            }}
          >
            <X className="size-4" />
            Clear
          </Button>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          <Select value={sort} onValueChange={(value) => updateParams({ sort: value === "created_desc" ? null : value })} items={SORT_OPTIONS}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger
              render={
                <Button variant="outline" size="sm">
                  <SlidersHorizontal className="size-4" />
                  Columns
                </Button>
              }
            />
            <PopoverContent align="end" className="w-56 p-2">
              <div className="flex flex-col gap-1">
                {DEAL_COLUMN_OPTIONS.map((col) => (
                  <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                    <Checkbox checked={columnVisibility[col.id] ?? true} onCheckedChange={() => toggleColumn(col.id)} />
                    {col.label}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" disabled={isExporting} onClick={exportAll}>
            <Download className="size-4" />
            {isExporting ? "Exporting..." : "Export"}
          </Button>

          <SavedViewsMenu views={savedViews} currentUserId={currentUserId} entityType="deal" basePath="/pipeline?view=list" />
        </div>
      </div>
    </div>
  );
}
