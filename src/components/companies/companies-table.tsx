"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Company } from "@/lib/types";

export type CompanyRow = Company & { owner: { id: string; full_name: string | null; email: string } | null };

export function CompaniesTable({ data }: { data: CompanyRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((c) => c.name.toLowerCase().includes(q) || c.domain?.toLowerCase().includes(q));
  }, [data, query]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-64">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input placeholder="Search companies..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No companies found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <Link href={`/companies/${company.id}`} className="font-medium hover:underline">
                      {company.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{company.domain ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{company.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{company.owner?.full_name ?? company.owner?.email ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
