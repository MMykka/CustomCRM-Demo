"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateTask } from "@/lib/actions/tasks";
import { TASK_TYPE_OPTIONS, type TaskRow } from "@/components/tasks/task-shared";
import { RecurrenceFields } from "@/components/tasks/recurrence-fields";
import type { RecurrenceUnit, TaskPriority, TaskType } from "@/lib/types";

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

function toDateInputValue(dueAt: string | null): string {
  return dueAt ? dueAt.slice(0, 10) : "";
}

export function EditTaskDialog({ task, open, onOpenChange }: { task: TaskRow; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [isPending, startTransition] = useTransition();
  const [titleValue, setTitleValue] = useState(task.title);
  const [dueAt, setDueAt] = useState(toDateInputValue(task.due_at));
  const [type, setType] = useState<TaskType>(task.type as TaskType);
  const [priority, setPriority] = useState<TaskPriority>(task.priority as TaskPriority);
  const [repeatEnabled, setRepeatEnabled] = useState(Boolean(task.recurrence_interval && task.recurrence_unit));
  const [recurrenceInterval, setRecurrenceInterval] = useState(task.recurrence_interval ?? 1);
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>((task.recurrence_unit as RecurrenceUnit) ?? "week");
  const [syncedOpen, setSyncedOpen] = useState(open);
  const router = useRouter();

  // Reset local form state on the render where the dialog transitions
  // closed -> open (React's "adjust state during render" pattern, matching
  // edit-contact-dialog.tsx/edit-deal-dialog.tsx).
  if (open && !syncedOpen) {
    setTitleValue(task.title);
    setDueAt(toDateInputValue(task.due_at));
    setType(task.type as TaskType);
    setPriority(task.priority as TaskPriority);
    setRepeatEnabled(Boolean(task.recurrence_interval && task.recurrence_unit));
    setRecurrenceInterval(task.recurrence_interval ?? 1);
    setRecurrenceUnit((task.recurrence_unit as RecurrenceUnit) ?? "week");
  }
  if (open !== syncedOpen) {
    setSyncedOpen(open);
  }

  function handleSubmit() {
    if (!titleValue.trim()) {
      toast.error("Enter a task title");
      return;
    }

    startTransition(async () => {
      await updateTask(task.id, {
        title: titleValue,
        dueAt: dueAt || null,
        type,
        priority,
        recurrenceInterval: repeatEnabled ? recurrenceInterval : null,
        recurrenceUnit: repeatEnabled ? recurrenceUnit : null,
      });
      toast.success("Task updated");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-task-title">Title</Label>
            <Input id="edit-task-title" value={titleValue} onChange={(e) => setTitleValue(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-task-due">Due date</Label>
              <Input id="edit-task-due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(value) => setType((value as TaskType) ?? "task")} items={TASK_TYPE_OPTIONS}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(value) => setPriority((value as TaskPriority) ?? "normal")} items={PRIORITY_OPTIONS}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <RecurrenceFields
            enabled={repeatEnabled}
            onEnabledChange={setRepeatEnabled}
            interval={recurrenceInterval}
            onIntervalChange={setRecurrenceInterval}
            unit={recurrenceUnit}
            onUnitChange={setRecurrenceUnit}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending || !titleValue.trim()}>
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
