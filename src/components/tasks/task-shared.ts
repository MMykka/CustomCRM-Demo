import { ListTodo, Mail, Phone, RotateCcw, type LucideIcon } from "lucide-react";
import type { Task, TaskType } from "@/lib/types";

export type TaskRow = Task & { contact: { id: string; first_name: string | null; last_name: string | null; email: string | null } | null };

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

export const TASK_TYPE_LABEL: Record<TaskType, string> = Object.fromEntries(TASK_TYPE_OPTIONS.map((o) => [o.value, o.label])) as Record<
  TaskType,
  string
>;
