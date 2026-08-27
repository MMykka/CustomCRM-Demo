"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectFilter, type FilterOption } from "@/components/contacts/multi-select-filter";
import { TASK_TYPE_OPTIONS } from "@/components/tasks/task-shared";

const PRIORITY_OPTIONS: FilterOption[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

export function TasksFilterBar({ owners }: { owners: { id: string; full_name: string | null; email: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    params.set("view", "all");
    router.replace(`/tasks?${params.toString()}`);
  }

  const assigneeOptions: FilterOption[] = owners.map((o) => ({ value: o.id, label: o.full_name ?? o.email }));
  const typeOptions: FilterOption[] = TASK_TYPE_OPTIONS;
  const status = searchParams.get("status") ?? "open";
  const hasFilters = Boolean(searchParams.get("assignee") || searchParams.get("type") || searchParams.get("priority") || searchParams.get("status"));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelectFilter
        label="Assignee"
        options={assigneeOptions}
        selected={searchParams.get("assignee")?.split(",").filter(Boolean) ?? []}
        onChange={(next) => updateParams({ assignee: next.length ? next.join(",") : null })}
      />
      <MultiSelectFilter
        label="Type"
        options={typeOptions}
        selected={searchParams.get("type")?.split(",").filter(Boolean) ?? []}
        onChange={(next) => updateParams({ type: next.length ? next.join(",") : null })}
      />
      <MultiSelectFilter
        label="Priority"
        options={PRIORITY_OPTIONS}
        selected={searchParams.get("priority")?.split(",").filter(Boolean) ?? []}
        onChange={(next) => updateParams({ priority: next.length ? next.join(",") : null })}
      />

      <Select value={status} onValueChange={(value) => updateParams({ status: value === "open" ? null : value })} items={STATUS_OPTIONS}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button variant="ghost" size="sm" onClick={() => router.replace("/tasks?view=all")}>
          <X className="size-4" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
