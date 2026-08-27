import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SpeedToLeadResult } from "@/lib/dashboard-speed-to-lead";

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function SpeedToLeadCard({ result }: { result: SpeedToLeadResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Speed to lead — this week</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-3xl font-semibold tracking-tight">{result.averageMinutes === null ? "—" : formatMinutes(result.averageMinutes)}</p>
        <p className="text-xs text-muted-foreground">average time to first outreach, based on {result.touchedCount} touched lead(s)</p>
        {result.untouchedCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            {result.untouchedCount} lead{result.untouchedCount === 1 ? "" : "s"} created this week {result.untouchedCount === 1 ? "has" : "have"} no
            outreach logged yet
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
