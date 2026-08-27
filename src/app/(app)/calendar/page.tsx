import Link from "next/link";
import { addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { OwnerFilter } from "@/components/calendar/owner-filter";
import { MonthView } from "@/components/calendar/month-view";
import { listOrgMembersForPicker } from "@/lib/actions/organizations";
import type { TaskRow } from "@/components/tasks/task-shared";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAppUser();
  const supabase = await createClient();
  const resolved = await searchParams;

  const monthParam = typeof resolved.month === "string" ? resolved.month : format(new Date(), "yyyy-MM");
  const ownerParam = typeof resolved.owner === "string" ? resolved.owner : null;

  const monthDate = new Date(`${monthParam}-01T00:00:00`);
  const gridStart = startOfWeek(startOfMonth(monthDate));
  const gridEnd = endOfWeek(endOfMonth(monthDate));

  let query = supabase
    .from("tasks")
    .select("*, contact:contacts(id, first_name, last_name, email), owner:users!tasks_assigned_to_fkey(id, full_name, email)")
    .neq("status", "cancelled")
    .not("due_at", "is", null)
    .gte("due_at", gridStart.toISOString())
    .lte("due_at", gridEnd.toISOString())
    .order("due_at", { ascending: true });

  if (ownerParam) query = query.eq("assigned_to", ownerParam);

  const [{ data: tasks, error }, owners] = await Promise.all([query, listOrgMembersForPicker()]);
  if (error) throw error;

  const prevMonth = format(subMonths(monthDate, 1), "yyyy-MM");
  const nextMonth = format(addMonths(monthDate, 1), "yyyy-MM");
  const monthQuery = ownerParam ? `&owner=${ownerParam}` : "";

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{format(monthDate, "MMMM yyyy")}</h1>
          <Button variant="outline" size="icon-sm" nativeButton={false} render={<Link href={`/calendar?month=${prevMonth}${monthQuery}`} />}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon-sm" nativeButton={false} render={<Link href={`/calendar?month=${nextMonth}${monthQuery}`} />}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={`/calendar${ownerParam ? `?owner=${ownerParam}` : ""}`} />}>
            Today
          </Button>
        </div>
        <OwnerFilter owners={owners} currentOwnerId={ownerParam} month={monthParam} />
      </div>

      <MonthView monthDate={monthDate} gridStart={gridStart} gridEnd={gridEnd} tasks={(tasks ?? []) as TaskRow[]} />
    </div>
  );
}
