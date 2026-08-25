"use client";

import { useActionState } from "react";
import { renameOrganization } from "@/lib/actions/organizations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function RenameOrgForm({ currentName }: { currentName: string }) {
  const [state, formAction, pending] = useActionState(renameOrganization, { error: null });

  return (
    <form action={formAction} className="flex max-w-sm items-end gap-2">
      <div className="flex flex-1 flex-col gap-1.5">
        <Input name="name" defaultValue={currentName} required />
        {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      </div>
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}
