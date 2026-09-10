"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createTag, deleteTag, renameTag, updateTagColor } from "@/lib/actions/tags";
import type { Tag } from "@/lib/types";

const PALETTE = ["#6366f1", "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#a855f7", "#ec4899", "#64748b"];

type TagWithUsage = Tag & { usageCount: number };

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className="size-5 rounded-full ring-offset-2 ring-offset-background transition-shadow"
          style={{ backgroundColor: color, boxShadow: value === color ? `0 0 0 2px ${color}` : undefined }}
          aria-label={color}
        />
      ))}
    </div>
  );
}

function NewTagDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      await createTag(name.trim(), color);
      setName("");
      setColor(PALETTE[0]);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">New tag</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New tag</DialogTitle>
          <DialogDescription>Tags can be applied to contacts to group and filter them.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Input placeholder="Tag name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <ColorPicker value={color} onChange={setColor} />
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

function TagRow({ tag }: { tag: TagWithUsage }) {
  const [name, setName] = useState(tag.name);
  const [isPending, startTransition] = useTransition();

  function commitRename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === tag.name) {
      setName(tag.name);
      return;
    }
    startTransition(() => renameTag(tag.id, trimmed));
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <ColorPicker value={tag.color} onChange={(color) => startTransition(() => updateTagColor(tag.id, color))} />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitRename}
        className="h-7 max-w-48"
        disabled={isPending}
      />
      <Badge variant="outline">{tag.usageCount} contact{tag.usageCount === 1 ? "" : "s"}</Badge>
      <div className="flex-1" />
      <Button variant="ghost" size="icon-sm" disabled={isPending} onClick={() => startTransition(() => deleteTag(tag.id))}>
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

export function TagManager({ tags }: { tags: TagWithUsage[] }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-end">
        <NewTagDialog />
      </div>
      <div className="flex flex-col divide-y">
        {tags.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No tags yet.</p> : tags.map((tag) => <TagRow key={tag.id} tag={tag} />)}
      </div>
    </div>
  );
}
