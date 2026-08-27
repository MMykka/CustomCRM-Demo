"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { addCompany } from "@/lib/actions/companies";

export function NewCompanyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "");
    const domain = String(formData.get("domain") ?? "");

    startTransition(async () => {
      const id = await addCompany({ name, domain });
      if (!id) {
        toast.error("Enter a company name");
        return;
      }
      formRef.current?.reset();
      onOpenChange(false);
      router.push(`/companies/${id}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" autoFocus required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domain">Domain</Label>
            <Input id="domain" name="domain" placeholder="acme.com" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
