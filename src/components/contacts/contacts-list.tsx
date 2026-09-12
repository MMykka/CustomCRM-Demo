"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { RowSelectionState, VisibilityState } from "@tanstack/react-table";
import { useHasMounted } from "@/lib/use-has-mounted";
import { createClient } from "@/lib/supabase/client";
import { ContactsToolbar } from "@/components/contacts/contacts-toolbar";
import { ContactsTable, type ContactRow } from "@/components/contacts/contacts-table";
import { ContactsPagination } from "@/components/contacts/contacts-pagination";
import { BulkActionToolbar } from "@/components/contacts/bulk-action-toolbar";
import { CONTACT_COLUMN_OPTIONS } from "@/components/contacts/columns";
import type { Contact, SavedView, Tag } from "@/lib/types";

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
  availableCampaigns,
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
  availableCampaigns: string[];
  availableSequences: { id: string; name: string }[];
  savedViews: SavedView[];
  currentUserId: string;
}) {
  const hasMounted = useHasMounted();
  const router = useRouter();
  const instanceId = useId();
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultColumnVisibility());
  const [syncedMounted, setSyncedMounted] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [localRows, setLocalRows] = useState(rows);
  const [syncedRows, setSyncedRows] = useState(rows);

  // Load the persisted column-visibility preference once hydration is safe
  // (render-time state adjustment owned by this component, not passed
  // cross-component -- see kanban-board.tsx for the same trick).
  if (hasMounted && !syncedMounted) {
    setSyncedMounted(true);
    setColumnVisibility(readStoredColumnVisibility());
  }

  // Re-seed from a fresh `rows` prop (e.g. after router.refresh()) --
  // render-time adjustment, not a setState-in-effect (see kanban-board.tsx).
  if (rows !== syncedRows) {
    setSyncedRows(rows);
    setLocalRows(rows);
  }

  // This page is paginated/filtered/sorted server-side, so a realtime INSERT
  // can't be safely spliced into `localRows` without risking the wrong sort
  // position or a row that doesn't belong on this page -- instead, edits to
  // rows already on screen are patched in place (no round trip), while an
  // insert or a delete triggers a server refetch of the current page so
  // pagination/filtering stays correct.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`contacts-${instanceId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "contacts" }, (payload) => {
        const updated = payload.new as Contact;
        setLocalRows((current) => current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "contacts" }, (payload) => {
        const deletedId = (payload.old as Contact).id;
        setLocalRows((current) => current.filter((row) => row.id !== deletedId));
        router.refresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contacts" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId, router]);

  function updateColumnVisibility(next: VisibilityState) {
    setColumnVisibility(next);
    try {
      window.localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(next));
    } catch {
      // ignore unavailable localStorage
    }
  }

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const selectedRows = localRows.filter((r) => selectedIds.includes(r.id));

  return (
    <div className="flex flex-col gap-4">
      <ContactsToolbar
        allTags={allTags}
        owners={owners}
        availableSources={availableSources}
        availableCampaigns={availableCampaigns}
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
      <ContactsTable data={localRows} columnVisibility={columnVisibility} rowSelection={rowSelection} onRowSelectionChange={setRowSelection} />
      <ContactsPagination page={page} pageSize={pageSize} totalCount={totalCount} />
    </div>
  );
}
