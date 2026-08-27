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
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/types";

export default async function ReportsPage() {
  await requireAppUser();
  const supabase = await createClient();
  const [forecast, leadVolume, wonRevenue, repPerformance] = await Promise.all([
    getForecastByMonth(supabase),
    getLeadVolumeByMonth(supabase),
    getWonRevenueByMonth(supabase),
    getRepPerformanceAllTime(supabase),
  ]);

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
