"use client";

import { flexRender, getCoreRowModel, useReactTable, type RowSelectionState, type VisibilityState } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dealColumns } from "./deal-columns";
import type { Deal } from "@/lib/types";

export type DealRow = Deal & {
  contact: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
  company: { id: string; name: string } | null;
  owner: { id: string; full_name: string | null; email: string } | null;
  stage: { id: string; name: string; color: string } | null;
  pipeline: { id: string; name: string } | null;
};

// Filtering/sorting/pagination all happen server-side (see
// src/lib/deals-query.ts, driven by the URL) -- this component is just a
// renderer over the already-filtered page of rows, mirroring contacts-table.tsx.
export function DealsTable({
  data,
  columnVisibility,
  rowSelection,
  onRowSelectionChange,
}: {
  data: DealRow[];
  columnVisibility: VisibilityState;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (next: RowSelectionState) => void;
}) {
  const table = useReactTable({
    data,
    columns: dealColumns,
    state: { columnVisibility, rowSelection },
    onColumnVisibilityChange: () => {},
    onRowSelectionChange: (updater) => {
      onRowSelectionChange(typeof updater === "function" ? updater(rowSelection) : updater);
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={dealColumns.length} className="h-24 text-center text-muted-foreground">
                No deals found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
