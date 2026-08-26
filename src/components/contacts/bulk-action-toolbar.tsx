"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tag as TagIcon, UserCog, ArrowRightLeft, Repeat, Trash2, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { bulkAssignOwner, bulkChangeLifecycleStage, bulkDeleteContacts, bulkEnrollInSequence, bulkTagContacts } from "@/lib/actions/contacts-bulk";
import { downloadCsv } from "@/lib/csv";
import { LIFECYCLE_STAGE_LABELS, type LifecycleStage, type Tag } from "@/lib/types";
import type { ContactRow } from "./contacts-table";

export function BulkActionToolbar({
  selectedIds,
  selectedRows,
  allTags,
  owners,
  availableSequences,
  onClearSelection,
}: {
  selectedIds: string[];
  selectedRows: ContactRow[];
  allTags: Tag[];
  owners: { id: string; full_name: string | null; email: string }[];
  availableSequences: { id: string; name: string }[];
  onClearSelection: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (selectedIds.length === 0) return null;

  function run(action: () => Promise<unknown>, successMessage: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMessage);
        onClearSelection();
        router.refresh();
      } catch {
        toast.error("That didn't work -- try again");
      }
    });
  }

  function exportSelected() {
    downloadCsv(
      `contacts-export-${new Date().toISOString().slice(0, 10)}.csv`,
      selectedRows.map((c) => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        phone: c.phone,
        job_title: c.job_title,
        source: c.source,
        lifecycle_stage: c.lifecycle_stage,
        lead_score: c.lead_score,
        company: c.company?.name ?? "",
        owner: c.owner?.full_name ?? c.owner?.email ?? "",
        tags: c.tags.map((t) => t.name).join(";"),
      })),
    );
  }

  function handleDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} contact${selectedIds.length === 1 ? "" : "s"}? This can't be undone.`)) return;
    run(() => bulkDeleteContacts(selectedIds), "Deleted");
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
      <span className="px-1 text-sm font-medium">{selectedIds.length} selected</span>

      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" disabled={isPending}>
              <TagIcon className="size-3.5" />
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
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => run(() => bulkTagContacts(selectedIds, tag.id), `Tagged ${selectedIds.length} contacts`)}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" disabled={isPending}>
              <UserCog className="size-3.5" />
              Assign owner
            </Button>
          }
        />
        <PopoverContent align="start" className="w-56 p-2">
          <div className="flex flex-col gap-1">
            {owners.map((owner) => (
              <button
                key={owner.id}
                type="button"
                onClick={() => run(() => bulkAssignOwner(selectedIds, owner.id), `Assigned ${selectedIds.length} contacts`)}
                className="rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {owner.full_name ?? owner.email}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm" disabled={isPending}>
              <ArrowRightLeft className="size-3.5" />
              Change stage
            </Button>
          }
        />
        <PopoverContent align="start" className="w-56 p-2">
          <div className="flex flex-col gap-1">
            {(Object.entries(LIFECYCLE_STAGE_LABELS) as [LifecycleStage, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => run(() => bulkChangeLifecycleStage(selectedIds, value), `Updated ${selectedIds.length} contacts`)}
                className="rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                {label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {availableSequences.length > 0 ? (
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline" size="sm" disabled={isPending}>
                <Repeat className="size-3.5" />
                Enroll in sequence
              </Button>
            }
          />
          <PopoverContent align="start" className="w-56 p-2">
            <div className="flex flex-col gap-1">
              {availableSequences.map((seq) => (
                <button
                  key={seq.id}
                  type="button"
                  onClick={() =>
                    run(async () => {
                      const result = await bulkEnrollInSequence(selectedIds, seq.id);
                      return result;
                    }, `Enrolled contacts in ${seq.name}`)
                  }
                  className="rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  {seq.name}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      <Button variant="outline" size="sm" onClick={exportSelected}>
        <Download className="size-3.5" />
        Export CSV
      </Button>

      <Button variant="destructive" size="sm" disabled={isPending} onClick={handleDelete}>
        <Trash2 className="size-3.5" />
        Delete
      </Button>

      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClearSelection}>
        <X className="size-3.5" />
        Clear
      </Button>
    </div>
  );
}
