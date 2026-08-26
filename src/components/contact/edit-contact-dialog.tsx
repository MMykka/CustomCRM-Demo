"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listCompaniesForPicker, updateContact } from "@/lib/actions/contacts";
import { listOrgMembersForPicker } from "@/lib/actions/organizations";
import { LIFECYCLE_STAGE_LABELS, type Contact, type LifecycleStage } from "@/lib/types";

const LIFECYCLE_STAGES = Object.entries(LIFECYCLE_STAGE_LABELS) as [LifecycleStage, string][];

type EditableContact = Contact & {
  company: { id: string; name: string } | null;
  owner: { id: string; full_name: string | null; email: string } | null;
};

export function EditContactDialog({
  contact,
  open,
  onOpenChange,
}: {
  contact: EditableContact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [companyId, setCompanyId] = useState(contact.company?.id ?? "");
  const [ownerId, setOwnerId] = useState(contact.owner?.id ?? "");
  const [lifecycleStage, setLifecycleStage] = useState<LifecycleStage>(contact.lifecycle_stage as LifecycleStage);
  const [syncedOpen, setSyncedOpen] = useState(open);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // Reset local form state on the render where the dialog transitions
  // closed -> open, rather than in a useEffect (React's "adjust state
  // during render" pattern -- see kanban-board.tsx for the same trick).
  if (open && !syncedOpen) {
    setCompanyId(contact.company?.id ?? "");
    setOwnerId(contact.owner?.id ?? "");
    setLifecycleStage(contact.lifecycle_stage as LifecycleStage);
  }
  if (open !== syncedOpen) {
    setSyncedOpen(open);
  }

  useEffect(() => {
    if (open) {
      listCompaniesForPicker().then(setCompanies);
      listOrgMembersForPicker().then(setMembers);
    }
  }, [open]);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateContact(contact.id, {
        firstName: String(formData.get("firstName") ?? ""),
        lastName: String(formData.get("lastName") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        jobTitle: String(formData.get("jobTitle") ?? ""),
        source: String(formData.get("source") ?? ""),
        lifecycleStage,
        leadScore: Number(formData.get("leadScore") ?? 0),
        companyId: companyId || null,
        ownerId: ownerId || null,
      });
      toast.success("Contact updated");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit contact</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" defaultValue={contact.first_name ?? ""} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" defaultValue={contact.last_name ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={contact.email ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" defaultValue={contact.phone ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" name="jobTitle" defaultValue={contact.job_title ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source">Source</Label>
              <Input id="source" name="source" defaultValue={contact.source ?? ""} />
            </div>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Lifecycle stage</Label>
              <Select value={lifecycleStage} onValueChange={(value) => setLifecycleStage((value as LifecycleStage) ?? "lead")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFECYCLE_STAGES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="leadScore">Lead score</Label>
              <Input id="leadScore" name="leadScore" type="number" min="0" max="100" defaultValue={contact.lead_score} />
            </div>
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
