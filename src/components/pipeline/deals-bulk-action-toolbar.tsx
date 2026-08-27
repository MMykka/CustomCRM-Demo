"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserCog, ArrowRightLeft, Trash2, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { bulkAssignOwner, bulkChangeStage, bulkDeleteDeals } from "@/lib/actions/deals-bulk";
import { downloadCsv } from "@/lib/csv";
import { contactDisplayName } from "@/lib/types";
import type { DealRow } from "./deals-table";

export function DealsBulkActionToolbar({
  selectedIds,
  selectedRows,
  owners,
  stages,
  onClearSelection,
}: {
  selectedIds: string[];
  selectedRows: DealRow[];
  owners: { id: string; full_name: string | null; email: string }[];
  stages: { id: string; name: string; pipeline_name: string; is_won: boolean; is_lost: boolean }[];
  onClearSelection: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (selectedIds.length === 0) return null;

  const openStages = stages.filter((s) => !s.is_won && !s.is_lost);

  function run(action: () => Promise<unknown>, successMessage: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMessage);
        onClearSelection();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "That didn't work -- try again");
      }
    });
  }

  function exportSelected() {
    downloadCsv(
      `deals-export-${new Date().toISOString().slice(0, 10)}.csv`,
      selectedRows.map((d) => ({
        id: d.id,
        title: d.title,
        value: d.value,
        currency: d.currency,
        status: d.status,
        stage: d.stage?.name ?? "",
        pipeline: d.pipeline?.name ?? "",
        contact: d.contact ? contactDisplayName(d.contact) : "",
        company: d.company?.name ?? "",
        owner: d.owner?.full_name ?? d.owner?.email ?? "",
      })),
    );
  }

  function handleDelete() {
    if (!window.confirm(`Delete ${selectedIds.length} deal${selectedIds.length === 1 ? "" : "s"}? This can't be undone.`)) return;
    run(() => bulkDeleteDeals(selectedIds), "Deleted");
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
      <span className="px-1 text-sm font-medium">{selectedIds.length} selected</span>

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
                onClick={() => run(() => bulkAssignOwner(selectedIds, owner.id), `Assigned ${selectedIds.length} deals`)}
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
        <PopoverContent align="start" className="w-64 p-2">
          <div className="flex flex-col gap-1">
            {openStages.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">No open stages</p>
            ) : (
              openStages.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => run(() => bulkChangeStage(selectedIds, stage.id), `Updated ${selectedIds.length} deals`)}
                  className="rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  {stage.pipeline_name} — {stage.name}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

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
