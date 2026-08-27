import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { avatarAccentClasses, formatCurrency, initialsFor } from "@/lib/types";
import type { RepPerformanceRow } from "@/lib/reports-rep-performance";

export function RepPerformanceTable({ rows }: { rows: RepPerformanceRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No org members yet.</p>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rep</TableHead>
            <TableHead className="text-right">Deals won</TableHead>
            <TableHead className="text-right">Revenue won</TableHead>
            <TableHead className="text-right">Win rate</TableHead>
            <TableHead className="text-right">Contacts touched</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="size-6 shrink-0">
                    <AvatarFallback className={`text-[10px] ${avatarAccentClasses(row.id)}`}>{initialsFor(row.name)}</AvatarFallback>
                  </Avatar>
                  {row.name}
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.dealsWon}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(row.revenueWon, row.currency)}</TableCell>
              <TableCell className="text-right tabular-nums">{row.winRate === null ? "—" : `${Math.round(row.winRate * 100)}%`}</TableCell>
              <TableCell className="text-right tabular-nums">{row.contactsTouched}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
