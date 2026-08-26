import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { StatTile } from "@/components/dashboard/stat-tile";
import { DealsByStageChart } from "@/components/dashboard/deals-by-stage-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/types";

export default async function DashboardPage() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [
    { count: contactCount },
    { count: companyCount },
    { data: openDeals },
    { count: tasksDueToday },
    { data: pipeline },
  ] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase.from("deals").select("value, currency, stage_id").eq("status", "open"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("assigned_to", appUser.id)
      .eq("status", "open")
      .lte("due_at", endOfDay.toISOString()),
    supabase
      .from("pipelines")
      .select("id, stages(id, name, position)")
      .eq("organization_id", appUser.organization_id!)
      .order("is_default", { ascending: false })
      .order("position")
      .limit(1)
      .single(),
  ]);

  const openDealsTotal = (openDeals ?? []).reduce((sum, d) => sum + d.value, 0);
  const currency = openDeals?.[0]?.currency ?? "USD";

  const stages = (pipeline?.stages ?? []).slice().sort((a, b) => a.position - b.position);
  const chartData = stages.map((stage) => ({
    stage: stage.name,
    value: (openDeals ?? []).filter((d) => d.stage_id === stage.id).reduce((sum, d) => sum + d.value, 0),
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Contacts" value={String(contactCount ?? 0)} accent="blue" />
        <StatTile label="Companies" value={String(companyCount ?? 0)} accent="pink" />
        <StatTile label="Open deals" value={String(openDeals?.length ?? 0)} hint={formatCurrency(openDealsTotal, currency)} accent="yellow" />
        <StatTile label="Due today" value={String(tasksDueToday ?? 0)} hint="tasks assigned to you" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open pipeline value by stage</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <DealsByStageChart data={chartData} />
          ) : (
            <p className="text-sm text-muted-foreground">No pipeline data yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
