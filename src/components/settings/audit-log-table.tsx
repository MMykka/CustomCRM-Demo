"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAuditLog } from "@/lib/actions/audit-log";
import type { Tables } from "@/lib/supabase/database.types";

type AuditRow = Tables<"audit_log"> & { actor: { id: string; full_name: string | null; email: string } | null };

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  INSERT: "secondary",
  UPDATE: "default",
  DELETE: "destructive",
};

function DiffCell({ row }: { row: AuditRow }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = row.old_data || row.new_data;
  if (!hasData) return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div>
      <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => setExpanded((v) => !v)}>
        {expanded ? "Hide" : "View"}
      </Button>
      {expanded ? (
        <div className="mt-2 flex flex-col gap-2">
          {row.old_data ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Before</p>
              <pre className="max-w-md overflow-x-auto rounded-md bg-muted p-2 text-xs">{JSON.stringify(row.old_data, null, 2)}</pre>
            </div>
          ) : null}
          {row.new_data ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">After</p>
              <pre className="max-w-md overflow-x-auto rounded-md bg-muted p-2 text-xs">{JSON.stringify(row.new_data, null, 2)}</pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AuditLogTable({ initialRows, tableNames }: { initialRows: AuditRow[]; tableNames: string[] }) {
  const [rows, setRows] = useState(initialRows);
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  function handleFilterChange(value: string | null) {
    if (!value) return;
    setTableFilter(value);
    startTransition(async () => {
      const next = await listAuditLog({ tableName: value === "all" ? undefined : value });
      setRows(next as AuditRow[]);
    });
  }

  function handleLoadMore() {
    const last = rows[rows.length - 1];
    if (!last) return;
    startTransition(async () => {
      const more = await listAuditLog({ tableName: tableFilter === "all" ? undefined : tableFilter, before: last.changed_at });
      setRows((prev) => [...prev, ...(more as AuditRow[])]);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Select value={tableFilter} onValueChange={handleFilterChange} items={[{ value: "all", label: "All tables" }, ...tableNames.map((t) => ({ value: t, label: t }))]}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All tables</SelectItem>
          {tableNames.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {rows.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Diff</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground">{format(new Date(row.changed_at), "MMM d, yyyy h:mm a")}</TableCell>
                <TableCell>{row.actor?.full_name ?? row.actor?.email ?? "System"}</TableCell>
                <TableCell className="font-mono text-xs">{row.table_name}</TableCell>
                <TableCell>
                  <Badge variant={ACTION_VARIANTS[row.action] ?? "outline"}>{row.action}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{row.record_id?.slice(0, 8) ?? "—"}</TableCell>
                <TableCell>
                  <DiffCell row={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {rows.length > 0 ? (
        <Button variant="outline" size="sm" className="w-fit" disabled={isPending} onClick={handleLoadMore}>
          {isPending ? "Loading..." : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
