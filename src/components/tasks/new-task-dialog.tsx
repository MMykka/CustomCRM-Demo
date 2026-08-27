"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addTask } from "@/lib/actions/tasks";
import { TASK_TYPE_OPTIONS } from "@/components/tasks/task-shared";
import { RecurrenceFields } from "@/components/tasks/recurrence-fields";
import type { RecurrenceUnit, TaskType } from "@/lib/types";

export function NewTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<TaskType>("task");
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [unit, setUnit] = useState<RecurrenceUnit>("week");
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function reset() {
    setType("task");
    setRepeatEnabled(false);
    setRecurrenceInterval(1);
    setUnit("week");
  }

  function handleSubmit(formData: FormData) {
    const title = String(formData.get("title") ?? "");
    const dueAt = String(formData.get("dueAt") ?? "");

    if (!title.trim()) {
      toast.error("Enter a task title");
      return;
    }

    startTransition(async () => {
      await addTask({
        title,
        dueAt: dueAt || null,
        type,
        recurrenceInterval: repeatEnabled ? recurrenceInterval : null,
        recurrenceUnit: repeatEnabled ? unit : null,
      });
      formRef.current?.reset();
      reset();
      onOpenChange(false);
      router.push("/tasks");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" autoFocus required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dueAt">Due date</Label>
              <Input id="dueAt" name="dueAt" type="date" />
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
          <RecurrenceFields
            enabled={repeatEnabled}
            onEnabledChange={setRepeatEnabled}
            interval={recurrenceInterval}
            onIntervalChange={setRecurrenceInterval}
            unit={unit}
            onUnitChange={setUnit}
          />
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
