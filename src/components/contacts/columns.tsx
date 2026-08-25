"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TagBadge } from "@/components/tag-badge";
import { contactDisplayName, initialsFor } from "@/lib/types";
import type { ContactRow } from "./contacts-table";

export const contactColumns: ColumnDef<ContactRow>[] = [
  {
    id: "name",
    accessorFn: (row) => contactDisplayName(row),
    header: "Name",
    cell: ({ row }) => {
      const name = contactDisplayName(row.original);
      return (
        <Link href={`/contacts/${row.original.id}`} className="flex items-center gap-2 font-medium hover:underline">
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">{initialsFor(name)}</AvatarFallback>
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
    filterFn: (row, _id, filterValue: string[]) => {
      if (!filterValue?.length) return true;
      const tagIds = row.original.tags.map((tag) => tag.id);
      return filterValue.some((tagId) => tagIds.includes(tagId));
    },
  },
];
