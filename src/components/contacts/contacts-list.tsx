"use client";

import { useState } from "react";
import type { RowSelectionState, VisibilityState } from "@tanstack/react-table";
import { useHasMounted } from "@/lib/use-has-mounted";
import { ContactsToolbar } from "@/components/contacts/contacts-toolbar";
import { ContactsTable, type ContactRow } from "@/components/contacts/contacts-table";
import { ContactsPagination } from "@/components/contacts/contacts-pagination";
import { BulkActionToolbar } from "@/components/contacts/bulk-action-toolbar";
import { CONTACT_COLUMN_OPTIONS } from "@/components/contacts/columns";
import type { SavedView, Tag } from "@/lib/types";

const COLUMN_VISIBILITY_KEY = "hub:contacts:columnVisibility";
const DEFAULT_HIDDEN = new Set(["created_at"]);

function defaultColumnVisibility(): VisibilityState {
  return Object.fromEntries(CONTACT_COLUMN_OPTIONS.map((c) => [c.id, !DEFAULT_HIDDEN.has(c.id)]));
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

export function ContactsList({
  rows,
  totalCount,
  page,
  pageSize,
  allTags,
  owners,
  availableSources,
  availableSequences,
  savedViews,
  currentUserId,
}: {
  rows: ContactRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  allTags: Tag[];
  owners: { id: string; full_name: string | null; email: string }[];
  availableSources: string[];
  availableSequences: { id: string; name: string }[];
  savedViews: SavedView[];
  currentUserId: string;
}) {
  const hasMounted = useHasMounted();
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultColumnVisibility());
  const [syncedMounted, setSyncedMounted] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Load the persisted column-visibility preference once hydration is safe
  // (render-time state adjustment owned by this component, not passed
  // cross-component -- see kanban-board.tsx for the same trick).
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
      <ContactsToolbar
        allTags={allTags}
        owners={owners}
        availableSources={availableSources}
        savedViews={savedViews}
        currentUserId={currentUserId}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={updateColumnVisibility}
      />
      <BulkActionToolbar
        selectedIds={selectedIds}
        selectedRows={selectedRows}
        allTags={allTags}
        owners={owners}
        availableSequences={availableSequences}
        onClearSelection={() => setRowSelection({})}
      />
      <ContactsTable data={rows} columnVisibility={columnVisibility} rowSelection={rowSelection} onRowSelectionChange={setRowSelection} />
      <ContactsPagination page={page} pageSize={pageSize} totalCount={totalCount} />
    </div>
  );
}
