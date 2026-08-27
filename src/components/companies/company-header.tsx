"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditCompanyDialog } from "@/components/companies/edit-company-dialog";
import type { Company } from "@/lib/types";

type HeaderCompany = Company & { owner: { id: string; full_name: string | null; email: string } | null };

export function CompanyHeader({ company }: { company: HeaderCompany }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {company.domain ? <span>{company.domain}</span> : null}
          {company.phone ? <span>{company.phone}</span> : null}
          {[company.city, company.state, company.country].filter(Boolean).length ? (
            <span>{[company.city, company.state, company.country].filter(Boolean).join(", ")}</span>
          ) : null}
          {company.owner ? <span>Owner: {company.owner.full_name ?? company.owner.email}</span> : null}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil className="size-4" />
        Edit
      </Button>
      <EditCompanyDialog company={company} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
