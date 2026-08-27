import { format } from "date-fns";
import { Users, Building2, Handshake, ListChecks, UserPlus, PhoneCall, Award, MessageCircleReply } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { StatTile } from "@/components/dashboard/stat-tile";
import { DealsByStageChart } from "@/components/dashboard/deals-by-stage-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/types";
import { getDashboardCardMetrics } from "@/lib/dashboard-metrics";
import { contactsFiltersToSearchParams } from "@/lib/contacts-query";

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
    { count: pipelineCount },
    cardMetrics,
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
      .select("id, name, stages(id, name, position)")
      .eq("organization_id", appUser.organization_id!)
      .order("is_default", { ascending: false })
      .order("position")
      .limit(1)
      .single(),
    supabase.from("pipelines").select("*", { count: "exact", head: true }).eq("organization_id", appUser.organization_id!),
    getDashboardCardMetrics(supabase, startOfDay, endOfDay),
  ]);

  const openDealsTotal = (openDeals ?? []).reduce((sum, d) => sum + d.value, 0);
  const currency = openDeals?.[0]?.currency ?? "USD";

  const stages = (pipeline?.stages ?? []).slice().sort((a, b) => a.position - b.position);
  const chartData = stages.map((stage) => ({
    stage: stage.name,
    value: (openDeals ?? []).filter((d) => d.stage_id === stage.id).reduce((sum, d) => sum + d.value, 0),
  }));

  const today = format(new Date(), "yyyy-MM-dd");
  const newLeadsHref = `/contacts?${contactsFiltersToSearchParams({ stages: ["lead"], dateFrom: today, dateTo: today }).toString()}`;

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Contacts" value={String(contactCount ?? 0)} icon={Users} />
        <StatTile label="Companies" value={String(companyCount ?? 0)} icon={Building2} />
        <StatTile
          label="Pipeline value"
          value={formatCurrency(openDealsTotal, currency)}
          hint={`${openDeals?.length ?? 0} open deals`}
          icon={Handshake}
          accent="blue"
        />
        <StatTile label="Due today" value={String(tasksDueToday ?? 0)} hint="tasks assigned to you" icon={ListChecks} accent="yellow" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="New leads today" value={String(cardMetrics.newLeadsToday)} icon={UserPlus} accent="blue" href={newLeadsHref} />
        <StatTile label="Replies waiting" value={String(cardMetrics.repliesWaiting)} icon={MessageCircleReply} accent="yellow" />
        <StatTile label="Calls booked this week" value={String(cardMetrics.callsBookedThisWeek)} icon={PhoneCall} />
        <StatTile
          label="Deals won this month"
          value={formatCurrency(cardMetrics.dealsWonThisMonth.value, cardMetrics.dealsWonThisMonth.currency)}
          hint={`${cardMetrics.dealsWonThisMonth.count} won`}
          icon={Award}
          accent="blue"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open pipeline value by stage{pipeline ? ` — ${pipeline.name}` : ""}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {chartData.length > 0 ? (
            <DealsByStageChart data={chartData} />
          ) : (
            <p className="text-sm text-muted-foreground">No pipeline data yet.</p>
          )}
          {(pipelineCount ?? 0) > 1 ? (
            <p className="text-xs text-muted-foreground">
              Showing {pipeline?.name} only — open deals in other pipelines aren&apos;t included in this breakdown.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
