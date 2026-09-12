import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import type { TaskRow } from "@/components/tasks/task-checklist";
import { AllTasksList } from "@/components/tasks/all-tasks-list";
import { MyDayTasks } from "@/components/tasks/my-day-tasks";
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
        <AllTasksList tasks={rows as TaskRow[]} showContact showAssignee />
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
  const openCount = all.filter((t) => t.status === "open").length;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Day</h1>
          <p className="text-sm text-muted-foreground">{openCount} open tasks</p>
        </div>
        <TasksViewToggle view="myday" />
      </div>

      <MyDayTasks initialTasks={all} userId={appUser.id} />
    </div>
  );
}
