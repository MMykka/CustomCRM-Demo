"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Download, Search, SlidersHorizontal, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectFilter, type FilterOption } from "@/components/contacts/multi-select-filter";
import { SavedViewsMenu } from "@/components/contacts/saved-views-menu";
import { CONTACT_COLUMN_OPTIONS } from "@/components/contacts/columns";
import { exportContactsForFilters } from "@/lib/actions/contacts-bulk";
import { downloadCsv } from "@/lib/csv";
import { LIFECYCLE_STAGE_LABELS, type LifecycleStage, type SavedView, type Tag } from "@/lib/types";
import type { VisibilityState } from "@tanstack/react-table";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "score_desc", label: "Lead score: high to low" },
  { value: "score_asc", label: "Lead score: low to high" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" },
];

export function ContactsToolbar({
  allTags,
  owners,
  availableSources,
  savedViews,
  currentUserId,
  columnVisibility,
  onColumnVisibilityChange,
}: {
  allTags: Tag[];
  owners: { id: string; full_name: string | null; email: string }[];
  availableSources: string[];
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
      const rows = await exportContactsForFilters(Object.fromEntries(searchParams.entries()));
      if (rows.length === 0) {
        toast.error("No contacts match the current filters");
        return;
      }
      downloadCsv(`contacts-export-${new Date().toISOString().slice(0, 10)}.csv`, rows);
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
    router.replace(`/contacts${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function toggleColumn(id: string) {
    onColumnVisibilityChange({ ...columnVisibility, [id]: !(columnVisibility[id] ?? true) });
  }

  const ownerOptions: FilterOption[] = owners.map((o) => ({ value: o.id, label: o.full_name ?? o.email }));
  const stageOptions: FilterOption[] = (Object.entries(LIFECYCLE_STAGE_LABELS) as [LifecycleStage, string][]).map(([value, label]) => ({ value, label }));
  const sourceOptions: FilterOption[] = availableSources.map((s) => ({ value: s, label: s }));
  const tagOptions: FilterOption[] = allTags.map((t) => ({ value: t.id, label: t.name, color: t.color }));

  const activeFilterCount = ["tags", "owners", "stages", "sources", "from", "to"].filter((k) => searchParams.get(k)).length;
  const sort = searchParams.get("sort") ?? "created_desc";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search contacts..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-8" />
        </div>

        <MultiSelectFilter
          label="Tags"
          options={tagOptions}
          selected={searchParams.get("tags")?.split(",").filter(Boolean) ?? []}
          onChange={(next) => updateParams({ tags: next.length ? next.join(",") : null })}
        />
        <MultiSelectFilter
          label="Owner"
          options={ownerOptions}
          selected={searchParams.get("owners")?.split(",").filter(Boolean) ?? []}
          onChange={(next) => updateParams({ owners: next.length ? next.join(",") : null })}
        />
        <MultiSelectFilter
          label="Stage"
          options={stageOptions}
          selected={searchParams.get("stages")?.split(",").filter(Boolean) ?? []}
          onChange={(next) => updateParams({ stages: next.length ? next.join(",") : null })}
        />
        <MultiSelectFilter
          label="Source"
          options={sourceOptions}
          selected={searchParams.get("sources")?.split(",").filter(Boolean) ?? []}
          onChange={(next) => updateParams({ sources: next.length ? next.join(",") : null })}
        />

        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm">
                Date
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

        {activeFilterCount > 0 || searchInput ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput("");
              router.replace("/contacts");
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
                {CONTACT_COLUMN_OPTIONS.map((col) => (
                  <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                    <Checkbox checked={columnVisibility[col.id] ?? true} onCheckedChange={() => toggleColumn(col.id)} />
                    {col.label}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/contacts/import" />}>
            <Upload className="size-4" />
            Import
          </Button>

          <Button variant="outline" size="sm" disabled={isExporting} onClick={exportAll}>
            <Download className="size-4" />
            {isExporting ? "Exporting..." : "Export"}
          </Button>

          <SavedViewsMenu views={savedViews} currentUserId={currentUserId} />
        </div>
      </div>
    </div>
  );
}
