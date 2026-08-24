"use client";

import { useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { TagBadge } from "@/components/tag-badge";
import { toggleContactTag } from "@/lib/actions/contacts";
import type { Tag } from "@/lib/types";

export function TagEditor({ contactId, allTags, activeTags }: { contactId: string; allTags: Tag[]; activeTags: Tag[] }) {
  const [isPending, startTransition] = useTransition();
  const activeIds = new Set(activeTags.map((t) => t.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {activeTags.map((tag) => (
        <TagBadge key={tag.id} name={tag.name} color={tag.color} />
      ))}
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs" disabled={isPending}>
              <Plus className="size-3" />
              Tag
            </Button>
          }
        />
        <PopoverContent align="start" className="w-56 p-2">
          <div className="flex flex-col gap-1">
            {allTags.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">No tags yet</p>
            ) : (
              allTags.map((tag) => (
                <label key={tag.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent">
                  <Checkbox
                    checked={activeIds.has(tag.id)}
                    onCheckedChange={(checked) =>
                      startTransition(() => toggleContactTag(contactId, tag.id, checked === true))
                    }
                  />
                  <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </label>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
