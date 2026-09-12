"use client";

import { useEffect, useId, useRef, useState } from "react";
import { isFuture, isPast, isToday } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { QuickAddTask } from "@/components/tasks/quick-add-task";
import { TaskChecklist, type TaskRow } from "@/components/tasks/task-checklist";
import type { Task } from "@/lib/types";

export function MyDayTasks({ initialTasks, userId }: { initialTasks: TaskRow[]; userId: string }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [syncedInitial, setSyncedInitial] = useState(initialTasks);
  const tasksRef = useRef(tasks);
  const instanceId = useId();

  // Re-seed local state when the server hands us a fresh tasks prop (e.g.
  // after a revalidate) -- render-time adjustment, not a setState-in-effect
  // (see kanban-board.tsx for the same idiom).
  if (initialTasks !== syncedInitial) {
    setSyncedInitial(initialTasks);
    setTasks(initialTasks);
  }

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`my-day-tasks-${userId}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `assigned_to=eq.${userId}` },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            setTasks((current) => current.filter((task) => task.id !== (payload.old as Task).id));
            return;
          }

          const updated = payload.new as Task;

          if (updated.status === "cancelled") {
            setTasks((current) => current.filter((task) => task.id !== updated.id));
            return;
          }

          setTasks((current) => {
            const exists = current.some((task) => task.id === updated.id);
            if (exists) return current.map((task) => (task.id === updated.id ? { ...task, ...updated } : task));
            return current;
          });

          const alreadyHasIt = tasksRef.current.some((task) => task.id === updated.id);
          if (!alreadyHasIt) {
            const { data } = await supabase
              .from("tasks")
              .select("*, contact:contacts(id, first_name, last_name, email)")
              .eq("id", updated.id)
              .single();
            if (data) {
              setTasks((current) => (current.some((task) => task.id === data.id) ? current : [...current, data as TaskRow]));
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, instanceId]);

  const open = tasks.filter((t) => t.status === "open");
  const completed = tasks.filter((t) => t.status === "completed");

  const isSnoozed = (t: TaskRow) => Boolean(t.snoozed_until && isFuture(new Date(t.snoozed_until)));
  const snoozed = open.filter(isSnoozed);
  const activeOpen = open.filter((t) => !isSnoozed(t));

  const overdue = activeOpen.filter((t) => t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at)));
  const today = activeOpen.filter((t) => t.due_at && isToday(new Date(t.due_at)));
  const upcoming = activeOpen.filter((t) => t.due_at && !isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at)));
  const noDueDate = activeOpen.filter((t) => !t.due_at);

  return (
    <div className="flex flex-col gap-8">
      <QuickAddTask />

      {overdue.length > 0 ? <Section title="Overdue" tasks={overdue} /> : null}
      <Section title="Today" tasks={today} />
      {snoozed.length > 0 ? <Section title="Snoozed" tasks={snoozed} /> : null}
      {upcoming.length > 0 ? <Section title="Upcoming" tasks={upcoming} /> : null}
      {noDueDate.length > 0 ? <Section title="No due date" tasks={noDueDate} /> : null}
      {completed.length > 0 ? <Section title="Completed" tasks={completed} /> : null}
    </div>
  );
}

function Section({ title, tasks }: { title: string; tasks: TaskRow[] }) {
  return (
    <div>
      <h2 className="mb-1 text-sm font-medium text-muted-foreground">{title}</h2>
      <TaskChecklist tasks={tasks} showContact />
    </div>
  );
}
