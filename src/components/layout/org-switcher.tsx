"use client";

import { useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { switchOrganization } from "@/lib/actions/organizations";

export function OrgSwitcher({ organizations, activeOrgId }: { organizations: { id: string; name: string }[]; activeOrgId: string }) {
  const [isPending, startTransition] = useTransition();
  const active = organizations.find((org) => org.id === activeOrgId);

  if (organizations.length <= 1) {
    return <div className="truncate px-2 text-sm font-medium">{active?.name ?? "The Hub"}</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" className="w-full justify-between px-2" disabled={isPending}>
            <span className="truncate">{active?.name ?? "Select organization"}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" className="w-56">
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => {
              if (org.id === activeOrgId) return;
              startTransition(() => switchOrganization(org.id));
            }}
          >
            <span className="flex-1 truncate">{org.name}</span>
            {org.id === activeOrgId ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
