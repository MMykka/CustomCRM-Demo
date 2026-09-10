"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createMessageTemplate, updateMessageTemplate } from "@/lib/actions/message-templates";
import { MERGE_FIELDS, renderMergeFields } from "@/lib/merge-fields";
import type { Tables } from "@/lib/supabase/database.types";

type Template = Tables<"message_templates">;

export function TemplateFormDialog({ template, trigger }: { template?: Template; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(template?.name ?? "");
  const [channel, setChannel] = useState<"sms" | "email">((template?.channel as "sms" | "email") ?? "email");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [isPending, startTransition] = useTransition();

  function insertToken(token: string) {
    setBody((prev) => `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${token}`);
  }

  function handleSave() {
    if (!name.trim() || !body.trim()) return;
    startTransition(async () => {
      if (template) {
        await updateMessageTemplate(template.id, { name: name.trim(), subject: channel === "email" ? subject : null, body });
      } else {
        await createMessageTemplate({ name: name.trim(), channel, subject: channel === "email" ? subject : null, body });
      }
      setOpen(false);
      if (!template) {
        setName("");
        setSubject("");
        setBody("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>Use merge fields to personalize the message for each recipient.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            {!template ? (
              <div className="flex flex-col gap-1.5">
                <Label>Channel</Label>
                <Select value={channel} onValueChange={(v) => v && setChannel(v as "sms" | "email")} items={[{ value: "email", label: "Email" }, { value: "sms", label: "SMS" }]}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          {channel === "email" ? (
            <div className="flex flex-col gap-1.5">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Body</Label>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-6 text-xs" />}>
                  Insert merge field <ChevronDown className="size-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {MERGE_FIELDS.map((field) => (
                    <DropdownMenuItem key={field.token} onClick={() => insertToken(field.token)}>
                      {field.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Preview</Label>
            <div className="rounded-md border bg-muted/50 p-2.5 text-sm whitespace-pre-wrap">{renderMergeFields(body) || "—"}</div>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" disabled={isPending || !name.trim() || !body.trim()} onClick={handleSave}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
