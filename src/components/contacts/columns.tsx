"use client";

import Link from "next/link";
import { format } from "date-fns";
import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TagBadge } from "@/components/tag-badge";
import { avatarAccentClasses, contactDisplayName, initialsFor, LIFECYCLE_STAGE_LABELS, type LifecycleStage } from "@/lib/types";
import type { ContactRow } from "./contacts-table";

export const CONTACT_COLUMN_OPTIONS: { id: string; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "company", label: "Company" },
  { id: "owner", label: "Owner" },
  { id: "tags", label: "Tags" },
  { id: "lifecycle_stage", label: "Lifecycle stage" },
  { id: "lead_score", label: "Lead score" },
  { id: "source", label: "Source" },
  { id: "campaign", label: "Campaign" },
  { id: "created_at", label: "Created" },
];

export const contactColumns: ColumnDef<ContactRow>[] = [
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
    id: "name",
    accessorFn: (row) => contactDisplayName(row),
    header: "Name",
    cell: ({ row }) => {
      const name = contactDisplayName(row.original);
      return (
        <Link href={`/contacts/${row.original.id}`} className="flex items-center gap-2 font-medium hover:underline">
          <Avatar className="size-7">
            <AvatarFallback className={`text-xs ${avatarAccentClasses(row.original.id)}`}>{initialsFor(name)}</AvatarFallback>
          </Avatar>
          {name}
        </Link>
      );
    },
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string | null) ?? "—"}</span>,
  },
  {
    accessorKey: "phone",
    header: "Phone",
    cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string | null) ?? "—"}</span>,
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
    id: "tags",
    header: "Tags",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.tags.map((tag) => (
          <TagBadge key={tag.id} name={tag.name} color={tag.color} />
        ))}
      </div>
    ),
  },
  {
    id: "lifecycle_stage",
    header: "Lifecycle stage",
    cell: ({ row }) => <Badge variant="outline">{LIFECYCLE_STAGE_LABELS[row.original.lifecycle_stage as LifecycleStage]}</Badge>,
  },
  {
    id: "lead_score",
    header: "Lead score",
    cell: ({ row }) => row.original.lead_score,
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string | null) ?? "—"}</span>,
  },
  {
    accessorKey: "campaign",
    header: "Campaign",
    cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string | null) ?? "—"}</span>,
  },
  {
    id: "created_at",
    header: "Created",
    cell: ({ row }) => <span className="text-muted-foreground">{format(new Date(row.original.created_at), "MMM d, yyyy")}</span>,
  },
];
