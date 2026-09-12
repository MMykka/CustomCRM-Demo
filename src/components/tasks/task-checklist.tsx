"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { addDays, addHours, addWeeks, format, isPast, setHours, setMinutes, startOfDay } from "date-fns";
import { toast } from "sonner";
import { AlarmClockOff, Clock, Pencil, Repeat } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toggleTaskComplete, addTask, snoozeTask, unsnoozeTask } from "@/lib/actions/tasks";
import { contactDisplayName, type TaskPriority, type TaskStatus, type TaskType } from "@/lib/types";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import { TASK_TYPE_ICON, TASK_TYPE_LABEL, TASK_TYPE_OPTIONS, type TaskRow } from "@/components/tasks/task-shared";

export type { TaskRow };
export { TASK_TYPE_OPTIONS };

const PRIORITY_VARIANT: Record<TaskPriority, "default" | "secondary" | "destructive"> = {
  low: "secondary",
  normal: "default",
  high: "destructive",
};

export function TaskChecklist({
  tasks,
  contactId,
  dealId,
  showContact = false,
  showAssignee = false,
  allowAdd = Boolean(contactId || dealId),
}: {
  tasks: TaskRow[];
  contactId?: string;
  dealId?: string;
  showContact?: boolean;
  showAssignee?: boolean;
  allowAdd?: boolean;
}) {
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, TaskStatus>>({});
  const [pendingTitles, setPendingTitles] = useState<{ tempId: string; title: string }[]>([]);

  function toggle(task: TaskRow, checked: boolean) {
    const nextStatus: TaskStatus = checked ? "completed" : "open";
    const previousStatus = statusOverrides[task.id] ?? task.status;
    setStatusOverrides((current) => ({ ...current, [task.id]: nextStatus }));
    startTransition(async () => {
      try {
        await toggleTaskComplete(task.id, checked);
      } catch {
        setStatusOverrides((current) => ({ ...current, [task.id]: previousStatus }));
        toast.error("Couldn't update task. Try again.");
      }
    });
  }

  function handleAdd(formData: FormData) {
    const title = String(formData.get("title") ?? "");
    const dueAt = String(formData.get("dueAt") ?? "");
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setPendingTitles((current) => [...current, { tempId, title }]);
    formRef.current?.reset();

    startTransition(async () => {
      try {
        await addTask({ title, dueAt: dueAt || null, contactId, dealId });
      } catch {
        toast.error("Couldn't add task. Try again.");
      } finally {
        setPendingTitles((current) => current.filter((p) => p.tempId !== tempId));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {allowAdd ? (
        <form ref={formRef} action={handleAdd} className="flex gap-2">
          <Input name="title" placeholder="New task..." required className="flex-1" />
          <Input name="dueAt" type="date" className="w-40" />
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      ) : null}

      <ul className="flex flex-col divide-y">
        {tasks.length === 0 && pendingTitles.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No tasks.</p>
        ) : (
          <>
            {pendingTitles.map((pending) => (
              <li key={pending.tempId} className="flex items-center gap-3 py-2.5 opacity-50">
                <Checkbox checked={false} disabled />
                <p className="min-w-0 flex-1 truncate text-sm">{pending.title}</p>
                <span className="text-xs text-muted-foreground">Adding...</span>
              </li>
            ))}
            {tasks.map((task) => {
              const status = statusOverrides[task.id] ?? task.status;
              const overdue = task.due_at && status === "open" && isPast(new Date(task.due_at));
              const TypeIcon = TASK_TYPE_ICON[task.type as TaskType];
              return (
                <li key={task.id} className="flex items-center gap-3 py-2.5">
                  <Checkbox checked={status === "completed"} onCheckedChange={(checked) => toggle(task, checked === true)} />
                  <span title={TASK_TYPE_LABEL[task.type as TaskType]} className="shrink-0">
                    <TypeIcon className="size-3.5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm ${status === "completed" ? "text-muted-foreground line-through" : ""}`}>{task.title}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {task.due_at ? (
                        <span className={overdue ? "font-medium text-destructive" : ""}>Due {format(new Date(task.due_at), "MMM d")}</span>
                      ) : null}
                      {task.recurrence_interval && task.recurrence_unit ? (
                        <span title={`Repeats every ${task.recurrence_interval} ${task.recurrence_unit}(s)`}>
                          <Repeat className="size-3 text-muted-foreground" />
                        </span>
                      ) : null}
                      {showContact && task.contact ? (
                        <Link href={`/contacts/${task.contact.id}`} className="hover:underline">
                          {contactDisplayName(task.contact)}
                        </Link>
                      ) : null}
                      {showAssignee && task.owner ? <span>{task.owner.full_name ?? task.owner.email}</span> : null}
                    </div>
                  </div>
                  <Badge variant={PRIORITY_VARIANT[task.priority as TaskPriority]} className="capitalize">
                    {task.priority}
                  </Badge>
                  {status === "open" ? <SnoozeControl taskId={task.id} snoozedUntil={task.snoozed_until} /> : null}
                  <Button variant="ghost" size="icon-sm" onClick={() => setEditingTask(task)} title="Edit task">
                    <Pencil className="size-3.5" />
                  </Button>
                </li>
              );
            })}
          </>
        )}
      </ul>

      {editingTask ? <EditTaskDialog task={editingTask} open={Boolean(editingTask)} onOpenChange={(open) => !open && setEditingTask(null)} /> : null}
    </div>
  );
}

function SnoozeControl({ taskId, snoozedUntil }: { taskId: string; snoozedUntil: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [customValue, setCustomValue] = useState("");
  const isSnoozed = snoozedUntil && new Date(snoozedUntil) > new Date();

  function snoozeUntil(date: Date) {
    startTransition(async () => {
      try {
        await snoozeTask(taskId, date.toISOString());
      } catch {
        toast.error("Couldn't snooze task. Try again.");
      }
    });
  }

  function unsnooze() {
    startTransition(async () => {
      try {
        await unsnoozeTask(taskId);
      } catch {
        toast.error("Couldn't unsnooze task. Try again.");
      }
    });
  }

  if (isSnoozed) {
    return (
      <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <span>Snoozed until {format(new Date(snoozedUntil), "MMM d, h:mm a")}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          onClick={unsnooze}
          title="Unsnooze"
        >
          <AlarmClockOff className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" disabled={isPending} title="Snooze">
            <Clock className="size-3.5" />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-56 p-2">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => snoozeUntil(addHours(new Date(), 1))}
          >
            1 hour
          </button>
          <button
            type="button"
            className="rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => snoozeUntil(setMinutes(setHours(addDays(startOfDay(new Date()), 1), 9), 0))}
          >
            Tomorrow 9am
          </button>
          <button
            type="button"
            className="rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => snoozeUntil(addWeeks(new Date(), 1))}
          >
            Next week
          </button>
          <div className="mt-1 flex items-center gap-1.5 border-t pt-2">
            <Input type="datetime-local" value={customValue} onChange={(e) => setCustomValue(e.target.value)} className="flex-1" />
            <Button size="sm" disabled={!customValue || isPending} onClick={() => snoozeUntil(new Date(customValue))}>
              Snooze
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
