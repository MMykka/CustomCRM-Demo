"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { avatarAccentClasses, contactDisplayName, formatCurrency, initialsFor } from "@/lib/types";
import type { DealRow } from "./deals-table";

export const DEAL_COLUMN_OPTIONS: { id: string; label: string }[] = [
  { id: "title", label: "Title" },
  { id: "value", label: "Value" },
  { id: "stage", label: "Stage" },
  { id: "pipeline", label: "Pipeline" },
  { id: "contact", label: "Contact" },
  { id: "company", label: "Company" },
  { id: "owner", label: "Owner" },
  { id: "expected_close_date", label: "Close date" },
  { id: "created_at", label: "Created" },
];

export const dealColumns: ColumnDef<DealRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
        onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(checked) => row.toggleSelected(checked === true)} aria-label="Select row" />,
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "title",
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <Link href={`/pipeline/${row.original.id}`} className="font-medium hover:underline">
        {row.original.title}
      </Link>
    ),
  },
  {
    id: "value",
    accessorKey: "value",
    header: "Value",
    cell: ({ row }) => <span className="font-medium">{formatCurrency(row.original.value, row.original.currency)}</span>,
  },
  {
    id: "stage",
    accessorFn: (row) => row.stage?.name ?? "",
    header: "Stage",
    cell: ({ row }) =>
      row.original.stage ? (
        <Badge variant="outline" style={{ borderColor: row.original.stage.color, color: row.original.stage.color }}>
          {row.original.stage.name}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "pipeline",
    accessorFn: (row) => row.pipeline?.name ?? "",
    header: "Pipeline",
    cell: ({ row }) => row.original.pipeline?.name ?? <span className="text-muted-foreground">—</span>,
  },
  {
    id: "contact",
    accessorFn: (row) => (row.contact ? contactDisplayName(row.contact) : ""),
    header: "Contact",
    cell: ({ row }) =>
      row.original.contact ? (
        <Link href={`/contacts/${row.original.contact.id}`} className="flex items-center gap-2 hover:underline">
          <Avatar className="size-6">
            <AvatarFallback className={`text-[10px] ${avatarAccentClasses(row.original.contact.id)}`}>
              {initialsFor(contactDisplayName(row.original.contact))}
            </AvatarFallback>
          </Avatar>
          {contactDisplayName(row.original.contact)}
        </Link>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "company",
    accessorFn: (row) => row.company?.name ?? "",
    header: "Company",
    cell: ({ row }) =>
      row.original.company ? (
        <Link href={`/companies/${row.original.company.id}`} className="hover:underline">
          {row.original.company.name}
        </Link>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "owner",
    accessorFn: (row) => row.owner?.full_name ?? row.owner?.email ?? "",
    header: "Owner",
    cell: ({ row }) => row.original.owner?.full_name ?? row.original.owner?.email ?? <span className="text-muted-foreground">—</span>,
  },
  {
    id: "expected_close_date",
    header: "Close date",
    cell: ({ row }) =>
      row.original.expected_close_date ? (
        <span className="text-muted-foreground">{format(new Date(row.original.expected_close_date), "MMM d, yyyy")}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "created_at",
    header: "Created",
    cell: ({ row }) => <span className="text-muted-foreground">{format(new Date(row.original.created_at), "MMM d, yyyy")}</span>,
  },
];
