"use client";

import { useActionState } from "react";
import { createOrganization } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CreateOrgForm() {
  const [state, formAction, pending] = useActionState(createOrganization, { error: null });

  return (
    <form action={formAction} className="flex max-w-sm items-end gap-2">
      <div className="flex flex-1 flex-col gap-1.5">
        <Input name="orgName" placeholder="New organization name" required />
        {state.error ? <p className="text-xs text-destructive">{state.error}</p> : null}
      </div>
      <Button type="submit" disabled={pending} size="sm" variant="outline">
        {pending ? "Creating..." : "Create"}
      </Button>
    </form>
  );
}
