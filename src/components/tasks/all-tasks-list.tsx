"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TaskChecklist, type TaskRow } from "@/components/tasks/task-checklist";
import type { Task } from "@/lib/types";

// This view is paginated/filtered/sorted server-side, so a realtime INSERT
// can't be safely spliced into `localTasks` -- see contacts-list.tsx for the
// same reasoning. Edits to tasks already on screen are patched in place;
// an insert or delete that could change this page's contents triggers a
// server refetch instead.
export function AllTasksList({ tasks, showContact, showAssignee }: { tasks: TaskRow[]; showContact?: boolean; showAssignee?: boolean }) {
  const router = useRouter();
  const instanceId = useId();
  const [localTasks, setLocalTasks] = useState(tasks);
  const [syncedTasks, setSyncedTasks] = useState(tasks);

  if (tasks !== syncedTasks) {
    setSyncedTasks(tasks);
    setLocalTasks(tasks);
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`all-tasks-${instanceId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tasks" }, (payload) => {
        const updated = payload.new as Task;
        setLocalTasks((current) => current.map((task) => (task.id === updated.id ? { ...task, ...updated } : task)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "tasks" }, (payload) => {
        const deletedId = (payload.old as Task).id;
        setLocalTasks((current) => current.filter((task) => task.id !== deletedId));
        router.refresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tasks" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [instanceId, router]);

  return <TaskChecklist tasks={localTasks} showContact={showContact} showAssignee={showAssignee} allowAdd={false} />;
}
