"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Star, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SortableList } from "@/components/pipeline/settings/sortable-list";
import { deletePipeline, reorderPipelines, setDefaultPipeline, updatePipeline } from "@/lib/actions/pipelines";
import type { Pipeline } from "@/lib/types";

export function PipelineListEditor({
  pipelines,
  selectedId,
  onSelect,
}: {
  pipelines: Pipeline[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(pipelineId: string) {
    startTransition(async () => {
      try {
        await deletePipeline(pipelineId);
        if (pipelineId === selectedId) {
          const remaining = pipelines.find((p) => p.id !== pipelineId);
          if (remaining) onSelect(remaining.id);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't delete pipeline");
      }
    });
  }

  return (
    <SortableList
      items={pipelines}
      onReorder={(orderedIds) => startTransition(() => reorderPipelines(orderedIds))}
      renderItem={(pipeline) => (
        <PipelineRow
          pipeline={pipeline}
          isSelected={pipeline.id === selectedId}
          disabled={isPending}
          onSelect={() => onSelect(pipeline.id)}
          onSetDefault={() => startTransition(() => setDefaultPipeline(pipeline.id))}
          onDelete={() => handleDelete(pipeline.id)}
        />
      )}
    />
  );
}

function PipelineRow({
  pipeline,
  isSelected,
  disabled,
  onSelect,
  onSetDefault,
  onDelete,
}: {
  pipeline: Pipeline;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(pipeline.name);
  const [syncedName, setSyncedName] = useState(pipeline.name);

  // See stage-editor.tsx's StageRow for why this needs to be a controlled
  // input with a render-time resync instead of defaultValue.
  if (pipeline.name !== syncedName) {
    setSyncedName(pipeline.name);
    setName(pipeline.name);
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onFocus={onSelect}
        onBlur={() => {
          const trimmed = name.trim();
          if (trimmed && trimmed !== pipeline.name) startTransition(() => updatePipeline(pipeline.id, { name: trimmed }));
        }}
        className={`h-8 flex-1 border-none bg-transparent shadow-none ${isSelected ? "font-medium" : ""}`}
      />
      <Button
        variant="ghost"
        size="icon-sm"
        title={pipeline.is_default ? "Default pipeline" : "Set as default"}
        disabled={disabled || isPending || pipeline.is_default}
        onClick={onSetDefault}
      >
        <Star className={`size-3.5 ${pipeline.is_default ? "fill-brand-yellow-foreground text-brand-yellow-foreground" : ""}`} />
      </Button>
      <Button variant="ghost" size="icon-sm" disabled={disabled || isPending} onClick={onDelete}>
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
