"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateCompany } from "@/lib/actions/companies";
import { listOrgMembersForPicker } from "@/lib/actions/organizations";
import type { Company } from "@/lib/types";

export function EditCompanyDialog({
  company,
  open,
  onOpenChange,
}: {
  company: Company & { owner: { id: string; full_name: string | null; email: string } | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [members, setMembers] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [ownerId, setOwnerId] = useState(company.owner?.id ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      listOrgMembersForPicker().then(setMembers);
    }
  }, [open]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateCompany(company.id, {
        name: String(formData.get("name") ?? ""),
        domain: String(formData.get("domain") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        address: String(formData.get("address") ?? ""),
        city: String(formData.get("city") ?? ""),
        state: String(formData.get("state") ?? ""),
        postalCode: String(formData.get("postalCode") ?? ""),
        country: String(formData.get("country") ?? ""),
        ownerId: ownerId || null,
      });
      toast.success("Company updated");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit company</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={company.name} autoFocus required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domain">Domain</Label>
            <Input id="domain" name="domain" defaultValue={company.domain ?? ""} placeholder="acme.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={company.phone ?? ""} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={company.address ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={company.city ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" defaultValue={company.state ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" name="postalCode" defaultValue={company.postal_code ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" defaultValue={company.country ?? ""} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Owner</Label>
            <Select value={ownerId} onValueChange={(value) => setOwnerId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name ?? m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
