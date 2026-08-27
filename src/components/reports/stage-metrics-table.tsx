import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StageMetricsResult } from "@/lib/reports-stage-metrics";

export function StageMetricsTable({ result }: { result: StageMetricsResult }) {
  if (result.stages.length === 0) {
    return <p className="text-sm text-muted-foreground">This pipeline has no stages yet.</p>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Stage</TableHead>
            <TableHead className="text-right">Deals entered</TableHead>
            <TableHead className="text-right">Conversion rate</TableHead>
            <TableHead className="text-right">Avg days in stage</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.stages.map((stage) => (
            <TableRow key={stage.stageId}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                  {stage.name}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{stage.dealsEntered}</TableCell>
              <TableCell className="text-right tabular-nums">
                {stage.conversionRate === null ? "—" : `${Math.round(stage.conversionRate * 100)}%`}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {stage.avgDaysInStage === null ? "—" : stage.avgDaysInStage.toFixed(1)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
