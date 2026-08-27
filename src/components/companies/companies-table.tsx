"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Repeat, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NewCompanyDialog } from "@/components/companies/new-company-dialog";
import { autoLinkContactsByDomain } from "@/lib/actions/companies";
import { formatCurrency, type Company } from "@/lib/types";

export type CompanyRow = Company & {
  owner: { id: string; full_name: string | null; email: string } | null;
  contactCount: number;
  openDealCount: number;
  openDealValue: number;
  totalRevenue: number;
  currency: string;
};

export function CompaniesTable({ data }: { data: CompanyRow[] }) {
  const [query, setQuery] = useState("");
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [isLinking, startLinking] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((c) => c.name.toLowerCase().includes(q) || c.domain?.toLowerCase().includes(q));
  }, [data, query]);

  function runAutoLink() {
    startLinking(async () => {
      const result = await autoLinkContactsByDomain();
      if (result.linked === 0) {
        toast.info("No contacts matched an existing company by domain");
      } else {
        toast.success(`Linked ${result.linked} contact${result.linked === 1 ? "" : "s"} by email domain`);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search companies..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
        </div>
        <Button variant="outline" size="sm" disabled={isLinking} onClick={runAutoLink}>
          <Repeat className="size-4" />
          {isLinking ? "Linking..." : "Auto-link contacts"}
        </Button>
        <Button size="sm" className="ml-auto" onClick={() => setNewDialogOpen(true)}>
          <Plus className="size-4" />
          New company
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Open deals</TableHead>
              <TableHead>Total revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
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
                  <TableCell className="text-muted-foreground">{company.owner?.full_name ?? company.owner?.email ?? "—"}</TableCell>
                  <TableCell>{company.contactCount}</TableCell>
                  <TableCell>
                    {company.openDealCount > 0 ? (
                      <span>
                        {company.openDealCount} · {formatCurrency(company.openDealValue, company.currency)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{company.totalRevenue > 0 ? formatCurrency(company.totalRevenue, company.currency) : <span className="text-muted-foreground">—</span>}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <NewCompanyDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} />
    </div>
  );
}
