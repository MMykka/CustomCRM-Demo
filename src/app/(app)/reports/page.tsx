import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { getForecastByMonth } from "@/lib/forecast";
import { ForecastChart } from "@/components/reports/forecast-chart";
import { getLeadVolumeByMonth, getWonRevenueByMonth } from "@/lib/reports-time-series";
import { LeadVolumeChart } from "@/components/reports/lead-volume-chart";
import { WonRevenueChart } from "@/components/reports/won-revenue-chart";
import { ReportExportButton } from "@/components/reports/report-export-button";
import { getRepPerformanceAllTime } from "@/lib/reports-rep-performance";
import { RepPerformanceTable } from "@/components/reports/rep-performance-table";
import { getContactFunnel } from "@/lib/reports-funnel";
import { FunnelChart } from "@/components/reports/funnel-chart";
import { getStageMetrics } from "@/lib/reports-stage-metrics";
import { StageMetricsTable } from "@/components/reports/stage-metrics-table";
import { listPipelinesForPicker } from "@/lib/actions/pipelines";
import { PipelinePicker } from "@/components/pipeline/pipeline-picker";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/types";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAppUser();
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;

  const [forecast, leadVolume, wonRevenue, repPerformance, funnelBySource, funnelByCampaign, pipelines] = await Promise.all([
    getForecastByMonth(supabase),
    getLeadVolumeByMonth(supabase),
    getWonRevenueByMonth(supabase),
    getRepPerformanceAllTime(supabase),
    getContactFunnel(supabase, "source"),
    getContactFunnel(supabase, "campaign"),
    listPipelinesForPicker(),
  ]);

  const requestedPipelineId = Array.isArray(resolvedSearchParams.pipeline) ? resolvedSearchParams.pipeline[0] : resolvedSearchParams.pipeline;
  const selectedPipeline = pipelines.find((p) => p.id === requestedPipelineId) ?? pipelines[0];
  const stageMetrics = selectedPipeline ? await getStageMetrics(supabase, selectedPipeline.id) : null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>

      <Card>
        <CardHeader>
          <CardTitle>Forecast: weighted pipeline value by month</CardTitle>
          <CardAction>
            <ReportExportButton filename={`forecast-export-${new Date().toISOString().slice(0, 10)}.csv`} rows={forecast.months} />
          </CardAction>
        </CardHeader>
        <CardContent>
          {forecast.months.length > 0 ? (
            <ForecastChart data={forecast.months} currency={forecast.currency} />
          ) : (
            <p className="text-sm text-muted-foreground">No open deals with an expected close date yet.</p>
          )}
        </CardContent>
      </Card>

      {forecast.undated.count > 0 ? (
        <p className="text-sm text-muted-foreground">
          {forecast.undated.count} open deal{forecast.undated.count === 1 ? "" : "s"} worth{" "}
          {formatCurrency(forecast.undated.value, forecast.currency)} have no expected close date and aren&apos;t included above.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Funnel by source</CardTitle>
          <CardAction>
            <ReportExportButton filename={`funnel-by-source-export-${new Date().toISOString().slice(0, 10)}.csv`} rows={funnelBySource.buckets} />
          </CardAction>
        </CardHeader>
        <CardContent>
          {funnelBySource.buckets.length > 0 ? (
            <FunnelChart data={funnelBySource} fieldLabel="source" />
          ) : (
            <p className="text-sm text-muted-foreground">No contacts yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Funnel by campaign</CardTitle>
          <CardAction>
            <ReportExportButton filename={`funnel-by-campaign-export-${new Date().toISOString().slice(0, 10)}.csv`} rows={funnelByCampaign.buckets} />
          </CardAction>
        </CardHeader>
        <CardContent>
          {funnelByCampaign.buckets.length > 0 ? (
            <FunnelChart data={funnelByCampaign} fieldLabel="campaign" />
          ) : (
            <p className="text-sm text-muted-foreground">No contacts yet.</p>
          )}
        </CardContent>
      </Card>

      {stageMetrics && selectedPipeline ? (
        <Card>
          <CardHeader>
            <CardTitle>Stage conversion & avg days in stage — {stageMetrics.pipelineName}</CardTitle>
            <CardAction>
              <div className="flex items-center gap-2">
                <PipelinePicker pipelines={pipelines} currentId={selectedPipeline.id} basePath="/reports" />
                <ReportExportButton
                  filename={`stage-metrics-export-${new Date().toISOString().slice(0, 10)}.csv`}
                  rows={stageMetrics.stages}
                />
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            <StageMetricsTable result={stageMetrics} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lead volume — last 12 months</CardTitle>
            <CardAction>
              <ReportExportButton filename={`lead-volume-export-${new Date().toISOString().slice(0, 10)}.csv`} rows={leadVolume.months} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <LeadVolumeChart data={leadVolume.months} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Won revenue — last 12 months</CardTitle>
            <CardAction>
              <ReportExportButton filename={`won-revenue-export-${new Date().toISOString().slice(0, 10)}.csv`} rows={wonRevenue.months} />
            </CardAction>
          </CardHeader>
          <CardContent>
            <WonRevenueChart data={wonRevenue.months} currency={wonRevenue.currency} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rep performance — all time</CardTitle>
          <CardAction>
            <ReportExportButton filename={`rep-performance-export-${new Date().toISOString().slice(0, 10)}.csv`} rows={repPerformance} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <RepPerformanceTable rows={repPerformance} />
        </CardContent>
      </Card>
    </div>
  );
}
