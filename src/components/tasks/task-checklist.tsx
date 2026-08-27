"use client";

import { useRef, useTransition } from "react";
import Link from "next/link";
import { format, isPast } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toggleTaskComplete, addTask } from "@/lib/actions/tasks";
import { contactDisplayName, type Task, type TaskPriority } from "@/lib/types";

export type TaskRow = Task & { contact: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null };

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
            return (
              <li key={task.id} className="flex items-center gap-3 py-2.5">
                <Checkbox
                  checked={task.status === "completed"}
                  onCheckedChange={(checked) => startTransition(() => toggleTaskComplete(task.id, checked === true))}
                />
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
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
