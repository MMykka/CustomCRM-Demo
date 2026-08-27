"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Pipeline } from "@/lib/types";

export function PipelineSwitcher({ pipelines, currentId }: { pipelines: Pipeline[]; currentId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(id: string | null) {
    if (!id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("pipeline", id);
    router.push(`/pipeline?${params.toString()}`);
    router.refresh();
  }

  if (pipelines.length <= 1) {
    return <h1 className="text-2xl font-semibold tracking-tight">{pipelines[0]?.name ?? "Pipeline"}</h1>;
  }

  return (
    <Select value={currentId} onValueChange={handleChange}>
      <SelectTrigger className="h-auto border-none bg-transparent px-0 text-2xl font-semibold tracking-tight shadow-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {pipelines.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
            {p.is_default ? " (default)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
