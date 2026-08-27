import { isFuture, isPast, isToday } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { TaskChecklist, type TaskRow } from "@/components/tasks/task-checklist";
import { QuickAddTask } from "@/components/tasks/quick-add-task";
import { TasksViewToggle } from "@/components/tasks/tasks-view-toggle";
import { TasksFilterBar } from "@/components/tasks/tasks-filter-bar";
import { TasksPagination } from "@/components/tasks/tasks-pagination";
import { parseTasksFilters, queryTasks, TASKS_PAGE_SIZE } from "@/lib/tasks-query";
import { listOrgMembersForPicker } from "@/lib/actions/organizations";

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const appUser = await requireAppUser();
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;
  const view = resolvedSearchParams.view === "all" ? "all" : "myday";

  if (view === "all") {
    const filters = parseTasksFilters(resolvedSearchParams);
    const [{ rows, totalCount }, owners] = await Promise.all([queryTasks(supabase, filters), listOrgMembersForPicker()]);

    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">All Tasks</h1>
            <p className="text-sm text-muted-foreground">{totalCount} tasks</p>
          </div>
          <TasksViewToggle view="all" />
        </div>
        <TasksFilterBar owners={owners} />
        <TaskChecklist tasks={rows as TaskRow[]} showContact showAssignee allowAdd={false} />
        <TasksPagination page={filters.page} pageSize={TASKS_PAGE_SIZE} totalCount={totalCount} />
      </div>
    );
  }

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

  const isSnoozed = (t: TaskRow) => Boolean(t.snoozed_until && isFuture(new Date(t.snoozed_until)));
  const snoozed = open.filter(isSnoozed);
  const activeOpen = open.filter((t) => !isSnoozed(t));

  const overdue = activeOpen.filter((t) => t.due_at && isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at)));
  const today = activeOpen.filter((t) => t.due_at && isToday(new Date(t.due_at)));
  const upcoming = activeOpen.filter((t) => t.due_at && !isPast(new Date(t.due_at)) && !isToday(new Date(t.due_at)));
  const noDueDate = activeOpen.filter((t) => !t.due_at);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Day</h1>
          <p className="text-sm text-muted-foreground">{open.length} open tasks</p>
        </div>
        <TasksViewToggle view="myday" />
      </div>

      <QuickAddTask />

      {overdue.length > 0 ? (
        <Section title="Overdue" tasks={overdue} showContact />
      ) : null}
      <Section title="Today" tasks={today} showContact />
      {snoozed.length > 0 ? <Section title="Snoozed" tasks={snoozed} showContact /> : null}
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
