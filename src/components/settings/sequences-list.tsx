"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createSequence, deleteSequence, toggleSequenceActive } from "@/lib/actions/sequences";
import type { Tables } from "@/lib/supabase/database.types";

type SequenceRow = Tables<"sequences"> & { stepCount: number };

function NewSequenceDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createSequence(name.trim(), description.trim());
      setName("");
      setDescription("");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">New sequence</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New sequence</DialogTitle>
          <DialogDescription>Add the steps afterward from the sequence builder.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" disabled={isPending || !name.trim()} onClick={handleCreate}>
            {isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SequencesList({ sequences }: { sequences: SequenceRow[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <NewSequenceDialog />
      </div>
      {sequences.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">No sequences yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Steps</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-9" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sequences.map((sequence) => (
              <TableRow key={sequence.id}>
                <TableCell>
                  <p className="font-medium">{sequence.name}</p>
                  {sequence.description ? <p className="text-xs text-muted-foreground">{sequence.description}</p> : null}
                </TableCell>
                <TableCell>{sequence.stepCount}</TableCell>
                <TableCell className="text-muted-foreground">{formatDistanceToNow(new Date(sequence.created_at), { addSuffix: true })}</TableCell>
                <TableCell>
                  <Switch
                    size="sm"
                    checked={sequence.is_active}
                    disabled={isPending}
                    onCheckedChange={(checked) => startTransition(() => toggleSequenceActive(sequence.id, checked))}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={isPending}
                    onClick={() => startTransition(() => deleteSequence(sequence.id))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
