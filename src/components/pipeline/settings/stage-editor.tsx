"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SortableList } from "@/components/pipeline/settings/sortable-list";
import { ColorSwatchPicker } from "@/components/pipeline/settings/color-swatch-picker";
import { createStage, deleteStage, reorderStages, updateStage } from "@/lib/actions/pipelines";
import type { Stage } from "@/lib/types";

export function StageEditor({ pipelineId, stages }: { pipelineId: string; stages: Stage[] }) {
  const [isPending, startTransition] = useTransition();
  const [newStageName, setNewStageName] = useState("");

  function handleAdd() {
    if (!newStageName.trim()) return;
    startTransition(async () => {
      await createStage(pipelineId, { name: newStageName });
      setNewStageName("");
    });
  }

  function handleDelete(stageId: string) {
    startTransition(async () => {
      try {
        await deleteStage(stageId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't delete stage");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <SortableList
        items={stages}
        onReorder={(orderedIds) => startTransition(() => reorderStages(pipelineId, orderedIds))}
        renderItem={(stage) => <StageRow stage={stage} onDelete={() => handleDelete(stage.id)} disabled={isPending} />}
      />
      <div className="flex gap-2">
        <Input
          placeholder="New stage name"
          value={newStageName}
          onChange={(e) => setNewStageName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button size="sm" onClick={handleAdd} disabled={isPending || !newStageName.trim()}>
          <Plus className="size-4" />
          Add stage
        </Button>
      </div>
    </div>
  );
}

function StageRow({ stage, onDelete, disabled }: { stage: Stage; onDelete: () => void; disabled: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(stage.name);
  const [syncedName, setSyncedName] = useState(stage.name);
  const [probability, setProbability] = useState(String(stage.probability));
  const [syncedProbability, setSyncedProbability] = useState(stage.probability);

  // Base UI's Input warns if a persistently-mounted (never remounted)
  // uncontrolled input's defaultValue prop changes after mount -- these
  // rows never unmount when sibling data changes, so they need to be
  // fully controlled with the render-time resync pattern used elsewhere
  // in this codebase (kanban-board.tsx, notification-bell.tsx) instead.
  if (stage.name !== syncedName) {
    setSyncedName(stage.name);
    setName(stage.name);
  }
  if (stage.probability !== syncedProbability) {
    setSyncedProbability(stage.probability);
    setProbability(String(stage.probability));
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ColorSwatchPicker value={stage.color} onChange={(color) => startTransition(() => updateStage(stage.id, { color }))} />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const trimmed = name.trim();
          if (trimmed && trimmed !== stage.name) startTransition(() => updateStage(stage.id, { name: trimmed }));
        }}
        className="w-40"
      />
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min="0"
          max="100"
          value={probability}
          onChange={(e) => setProbability(e.target.value)}
          onBlur={() => {
            const value = Number(probability) || 0;
            if (value !== stage.probability) startTransition(() => updateStage(stage.id, { probability: value }));
          }}
          className="w-16"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
      <label className="flex items-center gap-1.5 text-xs">
        <Switch checked={stage.is_won} onCheckedChange={(checked) => startTransition(() => updateStage(stage.id, { isWon: checked === true }))} />
        Won
      </label>
      <label className="flex items-center gap-1.5 text-xs">
        <Switch checked={stage.is_lost} onCheckedChange={(checked) => startTransition(() => updateStage(stage.id, { isLost: checked === true }))} />
        Lost
      </label>
      <Button variant="ghost" size="icon-sm" className="ml-auto" disabled={disabled || isPending} onClick={onDelete}>
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
