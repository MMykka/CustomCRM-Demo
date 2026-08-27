"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PipelineListEditor } from "@/components/pipeline/settings/pipeline-list-editor";
import { StageEditor } from "@/components/pipeline/settings/stage-editor";
import { NewPipelineDialog } from "@/components/pipeline/settings/new-pipeline-dialog";
import type { Pipeline, Stage } from "@/lib/types";

type PipelineWithStages = Pipeline & { stages: Stage[] };

export function PipelineSettingsClient({ pipelines }: { pipelines: PipelineWithStages[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(pipelines[0]?.id ?? null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  const selected = pipelines.find((p) => p.id === selectedId) ?? pipelines[0] ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Pipelines</h2>
          <Button variant="outline" size="sm" onClick={() => setNewDialogOpen(true)}>
            <Plus className="size-4" />
            New
          </Button>
        </div>
        {pipelines.length > 0 ? (
          <PipelineListEditor pipelines={pipelines} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
        ) : (
          <p className="text-sm text-muted-foreground">No pipelines yet.</p>
        )}
      </div>

      <div className="rounded-xl border p-4">
        {selected ? (
          <>
            <h2 className="mb-3 text-sm font-semibold">Stages for {selected.name}</h2>
            <StageEditor pipelineId={selected.id} stages={selected.stages} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Create a pipeline to configure its stages.</p>
        )}
      </div>

      <NewPipelineDialog open={newDialogOpen} onOpenChange={setNewDialogOpen} onCreated={setSelectedId} />
    </div>
  );
}
