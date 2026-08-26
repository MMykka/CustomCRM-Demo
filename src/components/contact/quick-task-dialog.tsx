"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { addTask } from "@/lib/actions/tasks";

// Backs both the "Book" and "Add task" header quick actions: there's no
// booking-calendar/telephony integration in this app (/calendar is an
// explicit "coming soon" stub), so a due-dated task is the closest real
// concept -- it needs no new schema and surfaces immediately in the
// existing Tasks panel and notify_task_assigned trigger.
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
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    if (next) {
      setTaskTitle(defaultTitle);
      setDueAt("");
    }
    onOpenChange(next);
  }

  function handleSubmit() {
    if (!taskTitle.trim()) return;
    startTransition(async () => {
      await addTask({ title: taskTitle, dueAt: dueAt || null, contactId });
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-task-due">Due</Label>
            <Input id="quick-task-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
          </div>
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
