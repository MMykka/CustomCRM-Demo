"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addTask } from "@/lib/actions/tasks";
import { TASK_TYPE_OPTIONS } from "@/components/tasks/task-shared";
import { RecurrenceFields } from "@/components/tasks/recurrence-fields";
import type { RecurrenceUnit, TaskType } from "@/lib/types";

// Backs both the "Book" and "Add task" header quick actions. There's still
// no telephony/booking integration in this app, so a due-dated task (now
// with a Call/Email/Follow-up type) is the closest real concept for
// "booking a call" -- it surfaces in the Tasks panel, the calendar view,
// and the existing notify_task_assigned trigger.
export function QuickTaskDialog({
  contactId,
  title,
  defaultTitle,
  open,
  onOpenChange,
}: {
  contactId: string;
  title: string;
  defaultTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [taskTitle, setTaskTitle] = useState(defaultTitle);
  const [dueAt, setDueAt] = useState("");
  const [type, setType] = useState<TaskType>("task");
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceUnit, setRecurrenceUnit] = useState<RecurrenceUnit>("week");
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    if (next) {
      setTaskTitle(defaultTitle);
      setDueAt("");
      setType("task");
      setRepeatEnabled(false);
      setRecurrenceInterval(1);
      setRecurrenceUnit("week");
    }
    onOpenChange(next);
  }

  function handleSubmit() {
    if (!taskTitle.trim()) return;
    startTransition(async () => {
      await addTask({
        title: taskTitle,
        dueAt: dueAt || null,
        contactId,
        type,
        recurrenceInterval: repeatEnabled ? recurrenceInterval : null,
        recurrenceUnit: repeatEnabled ? recurrenceUnit : null,
      });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-task-title">Title</Label>
            <Input id="quick-task-title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quick-task-due">Due</Label>
              <Input id="quick-task-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
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
            unit={recurrenceUnit}
            onUnitChange={setRecurrenceUnit}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isPending || !taskTitle.trim()}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
