"use client";

import { useState } from "react";
import { eachDayOfInterval, format, isSameMonth, isToday } from "date-fns";
import { Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { TaskChecklist } from "@/components/tasks/task-checklist";
import { TASK_TYPE_ICON, type TaskRow } from "@/components/tasks/task-shared";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog";
import type { TaskType } from "@/lib/types";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_PILLS = 3;

export function MonthView({ monthDate, gridStart, gridEnd, tasks }: { monthDate: Date; gridStart: Date; gridEnd: Date; tasks: TaskRow[] }) {
  const [newTaskDate, setNewTaskDate] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const tasksByDay = new Map<string, TaskRow[]>();
  for (const task of tasks) {
    if (!task.due_at) continue;
    const key = format(new Date(task.due_at), "yyyy-MM-dd");
    const existing = tasksByDay.get(key) ?? [];
    existing.push(task);
    tasksByDay.set(key, existing);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="p-2 text-center text-xs font-medium text-muted-foreground">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay.get(key) ?? [];
          const visible = dayTasks.slice(0, MAX_VISIBLE_PILLS);
          const overflowCount = dayTasks.length - visible.length;
          const inMonth = isSameMonth(day, monthDate);

          return (
            <div key={key} className={`group flex min-h-28 flex-col gap-1 border-b border-r p-1.5 ${inMonth ? "" : "bg-muted/20"}`}>
              <div className="flex items-center justify-between">
                {dayTasks.length > 0 ? (
                  <Popover>
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          className={`rounded px-1 text-xs hover:bg-accent ${isToday(day) ? "bg-primary text-primary-foreground" : inMonth ? "" : "text-muted-foreground"}`}
                        >
                          {format(day, "d")}
                        </button>
                      }
                    />
                    <PopoverContent align="start" className="w-80 p-3">
                      <p className="mb-2 text-sm font-medium">{format(day, "EEEE, MMM d")}</p>
                      <TaskChecklist tasks={dayTasks} showContact allowAdd={false} />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span className={`rounded px-1 text-xs ${isToday(day) ? "bg-primary text-primary-foreground" : inMonth ? "" : "text-muted-foreground"}`}>
                    {format(day, "d")}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-5 opacity-0 group-hover:opacity-100"
                  onClick={() => setNewTaskDate(key)}
                  title="New task"
                >
                  <Plus className="size-3" />
                </Button>
              </div>

              <div className="flex flex-col gap-0.5">
                {visible.map((task) => {
                  const TypeIcon = TASK_TYPE_ICON[task.type as TaskType];
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setEditingTask(task)}
                      className={`flex items-center gap-1 truncate rounded bg-muted px-1 py-0.5 text-left text-[11px] hover:bg-accent ${
                        task.status === "completed" ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      <TypeIcon className="size-2.5 shrink-0" />
                      <span className="truncate">{task.title}</span>
                    </button>
                  );
                })}
                {overflowCount > 0 ? <span className="px-1 text-[11px] text-muted-foreground">+{overflowCount} more</span> : null}
              </div>
            </div>
          );
        })}
      </div>

      {newTaskDate ? (
        <NewTaskDialog key={newTaskDate} defaultDueAt={newTaskDate} open onOpenChange={(open) => !open && setNewTaskDate(null)} />
      ) : null}
      {editingTask ? (
        <EditTaskDialog key={editingTask.id} task={editingTask} open onOpenChange={(open) => !open && setEditingTask(null)} />
      ) : null}
    </div>
  );
}
