import Link from "next/link";
import { format } from "date-fns";
import { Users, Building2, Handshake, ListChecks, UserPlus, PhoneCall, Award, MessageCircleReply } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { StatTile } from "@/components/dashboard/stat-tile";
import { DealsByStageChart } from "@/components/dashboard/deals-by-stage-chart";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/types";
import { getDashboardCardMetrics } from "@/lib/dashboard-metrics";
import { contactsFiltersToSearchParams } from "@/lib/contacts-query";
import { getTeamActivityFeed } from "@/lib/dashboard-feed";
import { TeamActivityFeed } from "@/components/dashboard/team-activity-feed";
import { getRepLeaderboard } from "@/lib/dashboard-leaderboard";
import { RepLeaderboard } from "@/components/dashboard/rep-leaderboard";
import { getSpeedToLead } from "@/lib/dashboard-speed-to-lead";
import { SpeedToLeadCard } from "@/components/dashboard/speed-to-lead-card";
import { listPipelinesForPicker } from "@/lib/actions/pipelines";
import { PipelinePicker } from "@/components/pipeline/pipeline-picker";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const appUser = await requireAppUser();
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [
    { count: contactCount },
    { count: companyCount },
    { data: openDeals },
    { count: tasksDueToday },
    pipelines,
    cardMetrics,
    feedItems,
    leaderboardRows,
    speedToLead,
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
    listPipelinesForPicker(),
    getDashboardCardMetrics(supabase, startOfDay, endOfDay),
    getTeamActivityFeed(supabase, 6),
    getRepLeaderboard(supabase),
    getSpeedToLead(supabase),
  ]);

  const openDealsTotal = (openDeals ?? []).reduce((sum, d) => sum + d.value, 0);
  const currency = openDeals?.[0]?.currency ?? "USD";

  const requestedPipelineId = Array.isArray(resolvedSearchParams.pipeline) ? resolvedSearchParams.pipeline[0] : resolvedSearchParams.pipeline;
  const pipeline = pipelines.find((p) => p.id === requestedPipelineId) ?? pipelines[0];

  const { data: stagesData } = pipeline
    ? await supabase.from("stages").select("id, name, position").eq("pipeline_id", pipeline.id).order("position")
    : { data: null };
  const stages = stagesData ?? [];
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
        <StatTile label="Contacts" value={String(contactCount ?? 0)} icon={Users} accent="blue" />
        <StatTile label="Companies" value={String(companyCount ?? 0)} icon={Building2} accent="yellow" />
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
        <StatTile label="Calls booked this week" value={String(cardMetrics.callsBookedThisWeek)} icon={PhoneCall} accent="yellow" />
        <StatTile
          label="Deals won this month"
          value={formatCurrency(cardMetrics.dealsWonThisMonth.value, cardMetrics.dealsWonThisMonth.currency)}
          hint={`${cardMetrics.dealsWonThisMonth.count} won`}
          icon={Award}
          accent="blue"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Open pipeline value by stage{pipeline ? ` — ${pipeline.name}` : ""}</CardTitle>
            {pipeline ? (
              <CardAction>
                <PipelinePicker pipelines={pipelines} currentId={pipeline.id} basePath="/dashboard" />
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {chartData.length > 0 ? (
              <DealsByStageChart data={chartData} />
            ) : (
              <p className="text-sm text-muted-foreground">No pipeline data yet.</p>
            )}
            {pipelines.length > 1 ? (
              <p className="text-xs text-muted-foreground">
                Showing {pipeline?.name} only — open deals in other pipelines aren&apos;t included in this breakdown.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <SpeedToLeadCard result={speedToLead} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Team activity</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/team-activity" />}>
                View all
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <TeamActivityFeed items={feedItems} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leaderboard — this month</CardTitle>
          </CardHeader>
          <CardContent>
            <RepLeaderboard rows={leaderboardRows} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
