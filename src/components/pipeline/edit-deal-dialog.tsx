"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateDeal } from "@/lib/actions/deals";
import { listContactsForPicker, listCompaniesForPicker } from "@/lib/actions/contacts";
import { listOrgMembersForPicker } from "@/lib/actions/organizations";
import type { Deal } from "@/lib/types";

type EditableDeal = Deal & {
  contact: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
  company: { id: string; name: string } | null;
  owner: { id: string; full_name: string | null; email: string } | null;
};

export function EditDealDialog({ deal, open, onOpenChange }: { deal: EditableDeal; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<{ id: string; label: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [contactId, setContactId] = useState(deal.contact?.id ?? "");
  const [companyId, setCompanyId] = useState(deal.company?.id ?? "");
  const [ownerId, setOwnerId] = useState(deal.owner?.id ?? "");
  const [syncedOpen, setSyncedOpen] = useState(open);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Reset local form state on the render where the dialog transitions
  // closed -> open (React's "adjust state during render" pattern, matching
  // edit-contact-dialog.tsx).
  if (open && !syncedOpen) {
    setContactId(deal.contact?.id ?? "");
    setCompanyId(deal.company?.id ?? "");
    setOwnerId(deal.owner?.id ?? "");
  }
  if (open !== syncedOpen) {
    setSyncedOpen(open);
  }

  useEffect(() => {
    if (open) {
      listContactsForPicker().then(setContacts);
      listCompaniesForPicker().then(setCompanies);
      listOrgMembersForPicker().then(setMembers);
    }
  }, [open]);

  function handleSubmit(formData: FormData) {
    const title = String(formData.get("title") ?? "");
    const value = Number(formData.get("value") ?? 0);
    const expectedCloseDate = String(formData.get("expectedCloseDate") ?? "");

    startTransition(async () => {
      await updateDeal(deal.id, {
        title,
        value,
        contactId: contactId || null,
        companyId: companyId || null,
        ownerId: ownerId || null,
        expectedCloseDate: expectedCloseDate || null,
      });
      toast.success("Deal updated");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit deal</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" defaultValue={deal.title} autoFocus required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="value">Value</Label>
              <Input id="value" name="value" type="number" min="0" step="1" defaultValue={deal.value} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expectedCloseDate">Close date</Label>
              <Input id="expectedCloseDate" name="expectedCloseDate" type="date" defaultValue={deal.expected_close_date ?? ""} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Contact</Label>
            <Select value={contactId} onValueChange={(value) => setContactId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No contact" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Company</Label>
            <Select value={companyId} onValueChange={(value) => setCompanyId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
