"use client";

import { useRef, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addTask } from "@/lib/actions/tasks";

export function QuickAddTask() {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        const title = String(formData.get("title") ?? "");
        const dueAt = String(formData.get("dueAt") ?? "");
        startTransition(async () => {
          await addTask({ title, dueAt: dueAt || null });
          formRef.current?.reset();
        });
      }}
      className="flex gap-2"
    >
      <Input name="title" placeholder="Add a task for today..." required className="flex-1" />
      <Input name="dueAt" type="date" className="w-40" />
      <Button type="submit" disabled={isPending}>
        Add
      </Button>
    </form>
  );
}
