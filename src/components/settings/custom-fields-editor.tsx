"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { createCustomField, deleteCustomField } from "@/lib/actions/custom-fields";
import { CUSTOM_FIELD_TYPE_LABELS, type CustomField, type CustomFieldEntityType, type CustomFieldType } from "@/lib/types";

const ENTITY_TABS: { value: CustomFieldEntityType; label: string }[] = [
  { value: "contact", label: "Contacts" },
  { value: "company", label: "Companies" },
  { value: "deal", label: "Deals" },
];

const FIELD_TYPES = Object.keys(CUSTOM_FIELD_TYPE_LABELS) as CustomFieldType[];

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function NewFieldDialog({ entityType }: { entityType: CustomFieldEntityType }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [isPending, startTransition] = useTransition();

  const needsOptions = fieldType === "select" || fieldType === "multiselect";

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const fieldKey = slugify(trimmed);
    if (!fieldKey) return;

    const options = needsOptions
      ? optionsText.split(",").map((o) => o.trim()).filter(Boolean)
      : null;

    startTransition(async () => {
      await createCustomField({ entityType, name: trimmed, fieldKey, fieldType, options });
      setName("");
      setOptionsText("");
      setFieldType("text");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">Add field</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New custom field</DialogTitle>
          <DialogDescription>Adds a field to every {entityType} record in the organization.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select value={fieldType} onValueChange={(v) => v && setFieldType(v as CustomFieldType)} items={FIELD_TYPES.map((t) => ({ value: t, label: CUSTOM_FIELD_TYPE_LABELS[t] }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {CUSTOM_FIELD_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsOptions ? (
            <div className="flex flex-col gap-1.5">
              <Label>Options (comma-separated)</Label>
              <Input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="Small, Medium, Large" />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button size="sm" disabled={isPending || !name.trim()} onClick={handleCreate}>
            {isPending ? "Adding..." : "Add field"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldsTable({ fields }: { fields: CustomField[] }) {
  const [isPending, startTransition] = useTransition();

  if (fields.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">No custom fields yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Options</TableHead>
          <TableHead className="w-9" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {fields.map((field) => (
          <TableRow key={field.id}>
            <TableCell className="font-medium">{field.name}</TableCell>
            <TableCell>{CUSTOM_FIELD_TYPE_LABELS[field.field_type as CustomFieldType]}</TableCell>
            <TableCell className="text-muted-foreground">
              {Array.isArray(field.options) ? (field.options as string[]).join(", ") : "—"}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={isPending}
                onClick={() => startTransition(() => deleteCustomField(field.id))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function CustomFieldsEditor({ fields }: { fields: CustomField[] }) {
  return (
    <Tabs defaultValue="contact">
      <div className="flex items-center justify-between">
        <TabsList>
          {ENTITY_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {ENTITY_TABS.map((tab) => {
        const entityFields = fields.filter((f) => f.entity_type === tab.value);
        return (
          <TabsContent key={tab.value} value={tab.value} className="flex flex-col gap-3">
            <div className="flex justify-end">
              <NewFieldDialog entityType={tab.value} />
            </div>
            <FieldsTable fields={entityFields} />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
