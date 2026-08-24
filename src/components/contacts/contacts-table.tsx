"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table";
import { Bookmark, Plus, Search, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { contactColumns } from "./columns";
import type { Contact, Tag } from "@/lib/types";

export type ContactRow = Contact & {
  company: { id: string; name: string } | null;
  owner: { id: string; full_name: string | null; email: string } | null;
  tags: Tag[];
};

type SavedView = { id: string; name: string; search: string; tagIds: string[] };

const SAVED_VIEWS_KEY = "hub:contacts:savedViews";

export function ContactsTable({ data, allTags }: { data: ContactRow[]; allTags: Tag[] }) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [newViewName, setNewViewName] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
      if (raw) setSavedViews(JSON.parse(raw));
    } catch {
      // ignore malformed/unavailable localStorage
    }
  }, []);

  const selectedTagIds = (columnFilters.find((f) => f.id === "tags")?.value as string[] | undefined) ?? [];

  const table = useReactTable({
    data,
    columns: contactColumns,
    state: { globalFilter, columnFilters, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  function toggleTag(tagId: string) {
    const next = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId];
    table.getColumn("tags")?.setFilterValue(next.length ? next : undefined);
  }

  function persistViews(views: SavedView[]) {
    setSavedViews(views);
    try {
      window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
    } catch {
      // ignore unavailable localStorage
    }
  }

  function saveCurrentView() {
    if (!newViewName.trim()) return;
    const view: SavedView = { id: crypto.randomUUID(), name: newViewName.trim(), search: globalFilter, tagIds: selectedTagIds };
    persistViews([...savedViews, view]);
    setNewViewName("");
    setSaveDialogOpen(false);
  }

  function applyView(view: SavedView) {
    setGlobalFilter(view.search);
    table.getColumn("tags")?.setFilterValue(view.tagIds.length ? view.tagIds : undefined);
  }

  function deleteView(id: string) {
    persistViews(savedViews.filter((v) => v.id !== id));
  }

  const tagsById = useMemo(() => new Map(allTags.map((t) => [t.id, t])), [allTags]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8"
          />
        </div>

        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm">
                Tags{selectedTagIds.length ? ` (${selectedTagIds.length})` : ""}
              </Button>
            }
          />
          <PopoverContent align="start" className="w-56 p-2">
            <div className="flex flex-col gap-1">
              {allTags.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">No tags yet</p>
              ) : (
                allTags.map((tag) => (
                  <label key={tag.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                    <Checkbox checked={selectedTagIds.includes(tag.id)} onCheckedChange={() => toggleTag(tag.id)} />
                    <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </label>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm">
                <Bookmark className="size-4" />
                Views
              </Button>
            }
          />
          <PopoverContent align="start" className="w-64 p-2">
            <div className="flex flex-col gap-1">
              {savedViews.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">No saved views yet</p>
              ) : (
                savedViews.map((view) => (
                  <div key={view.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => applyView(view)}
                      className="flex-1 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                    >
                      {view.name}
                    </button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => deleteView(view.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))
              )}
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger
                  render={
                    <Button variant="ghost" size="sm" className="mt-1 justify-start">
                      <Plus className="size-4" />
                      Save current view
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save view</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="view-name">View name</Label>
                    <Input id="view-name" value={newViewName} onChange={(e) => setNewViewName(e.target.value)} placeholder="e.g. Hot leads" />
                  </div>
                  <DialogFooter>
                    <Button onClick={saveCurrentView} disabled={!newViewName.trim()}>
                      Save
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </PopoverContent>
        </Popover>

        {selectedTagIds.length > 0 || globalFilter ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setGlobalFilter("");
              table.getColumn("tags")?.setFilterValue(undefined);
            }}
          >
            <X className="size-4" />
            Clear
          </Button>
        ) : null}
      </div>

      {selectedTagIds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedTagIds.map((tagId) => {
            const tag = tagsById.get(tagId);
            if (!tag) return null;
            return (
              <button key={tagId} type="button" onClick={() => toggleTag(tagId)} className="text-xs">
                <span className="rounded-full border px-2 py-0.5" style={{ borderColor: tag.color, color: tag.color }}>
                  {tag.name} ×
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
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
    </div>
  );
}
