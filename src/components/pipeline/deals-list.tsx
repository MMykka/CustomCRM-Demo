"use client";

import { useState } from "react";
import type { RowSelectionState, VisibilityState } from "@tanstack/react-table";
import { useHasMounted } from "@/lib/use-has-mounted";
import { DealsToolbar } from "@/components/pipeline/deals-toolbar";
import { DealsTable, type DealRow } from "@/components/pipeline/deals-table";
import { DealsPagination } from "@/components/pipeline/deals-pagination";
import { DealsBulkActionToolbar } from "@/components/pipeline/deals-bulk-action-toolbar";
import { DEAL_COLUMN_OPTIONS } from "@/components/pipeline/deal-columns";
import type { FilterOption } from "@/components/contacts/multi-select-filter";
import type { SavedView } from "@/lib/types";

const COLUMN_VISIBILITY_KEY = "hub:deals:columnVisibility";
const DEFAULT_HIDDEN = new Set(["created_at", "pipeline"]);

function defaultColumnVisibility(): VisibilityState {
  return Object.fromEntries(DEAL_COLUMN_OPTIONS.map((c) => [c.id, !DEFAULT_HIDDEN.has(c.id)]));
}

function readStoredColumnVisibility(): VisibilityState {
  try {
    const raw = window.localStorage.getItem(COLUMN_VISIBILITY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore malformed/unavailable localStorage
  }
  return defaultColumnVisibility();
}

export function DealsList({
  rows,
  totalCount,
  page,
  pageSize,
  owners,
  stageOptions,
  stages,
  savedViews,
  currentUserId,
}: {
  rows: DealRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  owners: { id: string; full_name: string | null; email: string }[];
  stageOptions: FilterOption[];
  stages: { id: string; name: string; pipeline_name: string; is_won: boolean; is_lost: boolean }[];
  savedViews: SavedView[];
  currentUserId: string;
}) {
  const hasMounted = useHasMounted();
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultColumnVisibility());
  const [syncedMounted, setSyncedMounted] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Load the persisted column-visibility preference once hydration is safe
  // (render-time state adjustment, same idiom as contacts-list.tsx).
  if (hasMounted && !syncedMounted) {
    setSyncedMounted(true);
    setColumnVisibility(readStoredColumnVisibility());
  }

  function updateColumnVisibility(next: VisibilityState) {
    setColumnVisibility(next);
    try {
      window.localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(next));
    } catch {
      // ignore unavailable localStorage
    }
  }

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const selectedRows = rows.filter((r) => selectedIds.includes(r.id));

  return (
    <div className="flex flex-col gap-4">
      <DealsToolbar
        owners={owners}
        stageOptions={stageOptions}
        savedViews={savedViews}
        currentUserId={currentUserId}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={updateColumnVisibility}
      />
      <DealsBulkActionToolbar
        selectedIds={selectedIds}
        selectedRows={selectedRows}
        owners={owners}
        stages={stages}
        onClearSelection={() => setRowSelection({})}
      />
      <DealsTable data={rows} columnVisibility={columnVisibility} rowSelection={rowSelection} onRowSelectionChange={setRowSelection} />
      <DealsPagination page={page} pageSize={pageSize} totalCount={totalCount} />
    </div>
  );
}
