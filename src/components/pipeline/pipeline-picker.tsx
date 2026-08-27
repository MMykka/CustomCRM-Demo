"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Compact pipeline switcher for scoping a single card/report to one
// pipeline via a URL search param -- distinct from pipeline-switcher.tsx,
// which is styled as the /pipeline page's own large H1-sized header control.
export function PipelinePicker({
  pipelines,
  currentId,
  basePath,
  paramName = "pipeline",
}: {
  pipelines: { id: string; name: string }[];
  currentId: string;
  basePath: string;
  paramName?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(id: string | null) {
    if (!id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, id);
    router.push(`${basePath}?${params.toString()}`);
  }

  if (pipelines.length <= 1) return null;

  return (
    <Select value={currentId} onValueChange={handleChange} items={pipelines.map((p) => ({ value: p.id, label: p.name }))}>
      <SelectTrigger size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {pipelines.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
