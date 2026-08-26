"use client";

import { flexRender, getCoreRowModel, useReactTable, type VisibilityState } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { contactColumns } from "./columns";
import type { Contact, Tag } from "@/lib/types";

export type ContactRow = Contact & {
  company: { id: string; name: string } | null;
  owner: { id: string; full_name: string | null; email: string } | null;
  tags: Tag[];
};

// Filtering/sorting/pagination all happen server-side now (see
// src/lib/contacts-query.ts, driven by the URL) -- this component is just
// a renderer over the already-filtered page of rows, with externally
// owned column visibility (see contacts-toolbar.tsx).
export function ContactsTable({ data, columnVisibility }: { data: ContactRow[]; columnVisibility: VisibilityState }) {
  const table = useReactTable({
    data,
    columns: contactColumns,
    state: { columnVisibility },
    onColumnVisibilityChange: () => {},
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
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={contactColumns.length} className="h-24 text-center text-muted-foreground">
                No contacts found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
