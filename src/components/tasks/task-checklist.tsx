"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { addDays, addHours, addWeeks, format, isPast, setHours, setMinutes, startOfDay } from "date-fns";
import { AlarmClockOff, Clock, ListTodo, Mail, Phone, RotateCcw, type LucideIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toggleTaskComplete, addTask, snoozeTask, unsnoozeTask } from "@/lib/actions/tasks";
import { contactDisplayName, type Task, type TaskPriority, type TaskType } from "@/lib/types";

export type TaskRow = Task & { contact: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null };

const PRIORITY_VARIANT: Record<TaskPriority, "default" | "secondary" | "destructive"> = {
  low: "secondary",
  normal: "default",
  high: "destructive",
};

export const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: "task", label: "General" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "follow_up", label: "Follow-up" },
];

export const TASK_TYPE_ICON: Record<TaskType, LucideIcon> = {
  task: ListTodo,
  call: Phone,
  email: Mail,
  follow_up: RotateCcw,
};

const TASK_TYPE_LABEL: Record<TaskType, string> = Object.fromEntries(TASK_TYPE_OPTIONS.map((o) => [o.value, o.label])) as Record<TaskType, string>;

export function TaskChecklist({
  tasks,
  contactId,
  dealId,
  showContact = false,
  allowAdd = Boolean(contactId || dealId),
}: {
  tasks: TaskRow[];
  contactId?: string;
  dealId?: string;
  showContact?: boolean;
  allowAdd?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex flex-col gap-4">
      {allowAdd ? (
        <form
          ref={formRef}
          action={(formData) => {
            const title = String(formData.get("title") ?? "");
            const dueAt = String(formData.get("dueAt") ?? "");
            startTransition(async () => {
              await addTask({ title, dueAt: dueAt || null, contactId, dealId });
              formRef.current?.reset();
            });
          }}
          className="flex gap-2"
        >
          <Input name="title" placeholder="New task..." required className="flex-1" />
          <Input name="dueAt" type="date" className="w-40" />
          <Button type="submit" size="sm" disabled={isPending}>
            Add
          </Button>
        </form>
      ) : null}

      <ul className="flex flex-col divide-y">
        {tasks.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No tasks.</p>
        ) : (
          tasks.map((task) => {
            const overdue = task.due_at && task.status === "open" && isPast(new Date(task.due_at));
            const TypeIcon = TASK_TYPE_ICON[task.type as TaskType];
            return (
              <li key={task.id} className="flex items-center gap-3 py-2.5">
                <Checkbox
                  checked={task.status === "completed"}
                  onCheckedChange={(checked) => startTransition(() => toggleTaskComplete(task.id, checked === true))}
                />
                <span title={TASK_TYPE_LABEL[task.type as TaskType]} className="shrink-0">
                  <TypeIcon className="size-3.5 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${task.status === "completed" ? "text-muted-foreground line-through" : ""}`}>{task.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {task.due_at ? (
                      <span className={overdue ? "font-medium text-destructive" : ""}>Due {format(new Date(task.due_at), "MMM d")}</span>
                    ) : null}
                    {showContact && task.contact ? (
                      <Link href={`/contacts/${task.contact.id}`} className="hover:underline">
                        {contactDisplayName(task.contact)}
                      </Link>
                    ) : null}
                  </div>
                </div>
                <Badge variant={PRIORITY_VARIANT[task.priority as TaskPriority]} className="capitalize">
                  {task.priority}
                </Badge>
                {task.status === "open" ? <SnoozeControl taskId={task.id} snoozedUntil={task.snoozed_until} /> : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function SnoozeControl({ taskId, snoozedUntil }: { taskId: string; snoozedUntil: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [customValue, setCustomValue] = useState("");
  const isSnoozed = snoozedUntil && new Date(snoozedUntil) > new Date();

  function snoozeUntil(date: Date) {
    startTransition(() => snoozeTask(taskId, date.toISOString()));
  }

  if (isSnoozed) {
    return (
      <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
        <span>Snoozed until {format(new Date(snoozedUntil), "MMM d, h:mm a")}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={isPending}
          onClick={() => startTransition(() => unsnoozeTask(taskId))}
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
