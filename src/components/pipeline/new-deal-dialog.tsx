"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDeal } from "@/lib/actions/deals";
import { listContactsForPicker } from "@/lib/actions/contacts";
import { listPipelinesForPicker } from "@/lib/actions/pipelines";

export function NewDealDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<{ id: string; label: string }[]>([]);
  const [contactId, setContactId] = useState<string>("");
  const [pipelines, setPipelines] = useState<{ id: string; name: string; is_default: boolean }[]>([]);
  const [pipelineId, setPipelineId] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      listContactsForPicker().then(setContacts);
      listPipelinesForPicker().then((data) => {
        setPipelines(data);
        setPipelineId((current) => current || data.find((p) => p.is_default)?.id || data[0]?.id || "");
      });
    }
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setContactId("");
      setPipelineId("");
    }
    onOpenChange(next);
  }

  function handleSubmit(formData: FormData) {
    const title = String(formData.get("title") ?? "");
    const value = Number(formData.get("value") ?? 0);

    startTransition(async () => {
      const id = await addDeal({ title, value, contactId: contactId || null, pipelineId: pipelineId || null });
      if (!id) {
        toast.error("Enter a deal title");
        return;
      }
      formRef.current?.reset();
      handleOpenChange(false);
      router.push(pipelineId ? `/pipeline?pipeline=${pipelineId}` : "/pipeline");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New deal</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" autoFocus required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="value">Value</Label>
            <Input id="value" name="value" type="number" min="0" step="1" />
          </div>
          {pipelines.length > 1 ? (
            <div className="flex flex-col gap-1.5">
              <Label>Pipeline</Label>
              <Select
                value={pipelineId}
                onValueChange={(value) => setPipelineId(value ?? "")}
                items={pipelines.map((p) => ({ value: p.id, label: `${p.name}${p.is_default ? " (default)" : ""}` }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.is_default ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <Label>Contact</Label>
            <Select
              value={contactId}
              onValueChange={(value) => setContactId(value ?? "")}
              items={contacts.map((contact) => ({ value: contact.id, label: contact.label }))}
            >
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
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create deal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
