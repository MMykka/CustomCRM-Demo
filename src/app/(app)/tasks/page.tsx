import { isPast, isToday } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { TaskChecklist, type TaskRow } from "@/components/tasks/task-checklist";
import { QuickAddTask } from "@/components/tasks/quick-add-task";

export default async function TasksPage() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("*, contact:contacts(id, first_name, last_name, email)")
    .eq("assigned_to", appUser.id)
    .neq("status", "cancelled")
    .order("due_at", { ascending: true, nullsFirst: false });

  if (error) throw error;

  const all = (tasks ?? []) as TaskRow[];
  const open = all.filter((t) => t.status === "open");
  const completed = all.filter((t) => t.status === "completed");

  const overdue = open.filter((t) => t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at)));
  const today = open.filter((t) => t.due_at && isToday(new Date(t.due_at)));
  const upcoming = open.filter((t) => t.due_at && !isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at)));
  const noDueDate = open.filter((t) => !t.due_at);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Day</h1>
        <p className="text-sm text-muted-foreground">{open.length} open tasks</p>
      </div>

      <QuickAddTask />

      {overdue.length > 0 ? (
        <Section title="Overdue" tasks={overdue} showContact />
      ) : null}
      <Section title="Today" tasks={today} showContact />
      {upcoming.length > 0 ? <Section title="Upcoming" tasks={upcoming} showContact /> : null}
      {noDueDate.length > 0 ? <Section title="No due date" tasks={noDueDate} showContact /> : null}
      {completed.length > 0 ? <Section title="Completed" tasks={completed} showContact /> : null}
    </div>
  );
}

function Section({ title, tasks, showContact }: { title: string; tasks: TaskRow[]; showContact: boolean }) {
  return (
    <div>
      <h2 className="mb-1 text-sm font-medium text-muted-foreground">{title}</h2>
      <TaskChecklist tasks={tasks} showContact={showContact} />
    </div>
  );
}
