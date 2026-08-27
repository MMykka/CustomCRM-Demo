import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const TASKS_PAGE_SIZE = 100;

export type TasksFilters = {
  assigneeIds: string[];
  types: string[];
  priorities: string[];
  status: "open" | "completed" | "all";
  page: number;
};

function parseCsv(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? raw.split(",").filter(Boolean) : [];
}

export function parseTasksFilters(searchParams: Record<string, string | string[] | undefined>): TasksFilters {
  const status = typeof searchParams.status === "string" && ["open", "completed", "all"].includes(searchParams.status) ? (searchParams.status as TasksFilters["status"]) : "open";

  return {
    assigneeIds: parseCsv(searchParams.assignee),
    types: parseCsv(searchParams.type),
    priorities: parseCsv(searchParams.priority),
    status,
    page: Math.max(1, Number(searchParams.page) || 1),
  };
}

// Tasks are a much shorter-lived, self-cleaning entity than contacts/deals
// (open tasks realistically number in the low hundreds per org), so this
// intentionally skips the saved-views/heavy-pagination machinery those use.
export async function queryTasks(supabase: SupabaseClient<Database>, filters: TasksFilters, pageSize: number = TASKS_PAGE_SIZE) {
  let query = supabase
    .from("tasks")
    .select("*, contact:contacts(id, first_name, last_name, email), owner:users!tasks_assigned_to_fkey(id, full_name, email)", { count: "exact" })
    .neq("status", "cancelled");

  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.assigneeIds.length) query = query.in("assigned_to", filters.assigneeIds);
  if (filters.types.length) query = query.in("type", filters.types);
  if (filters.priorities.length) query = query.in("priority", filters.priorities);

  query = query.order("due_at", { ascending: true, nullsFirst: false });

  const from = (filters.page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return { rows: data ?? [], totalCount: count ?? 0 };
}
