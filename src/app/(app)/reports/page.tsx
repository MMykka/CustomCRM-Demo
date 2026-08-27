import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { getForecastByMonth } from "@/lib/forecast";
import { ForecastChart } from "@/components/reports/forecast-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/types";

export default async function ReportsPage() {
  await requireAppUser();
  const supabase = await createClient();
  const forecast = await getForecastByMonth(supabase);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>

      <Card>
        <CardHeader>
          <CardTitle>Forecast: weighted pipeline value by month</CardTitle>
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
    </div>
  );
}
