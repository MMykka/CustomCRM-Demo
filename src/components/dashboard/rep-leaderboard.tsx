import { initialsFor } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { RepLeaderboardRow } from "@/lib/dashboard-leaderboard";

export function RepLeaderboard({ rows }: { rows: RepLeaderboardRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No org members yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1.5rem_1fr_auto_auto_auto] items-center gap-x-3 text-xs font-medium uppercase text-muted-foreground">
        <span />
        <span>Rep</span>
        <span className="text-right">Touched</span>
        <span className="text-right">Calls</span>
        <span className="text-right">Won</span>
      </div>
      {rows.map((row, index) => (
        <div key={row.id} className="grid grid-cols-[1.5rem_1fr_auto_auto_auto] items-center gap-x-3 text-sm">
          <span className="text-xs text-muted-foreground">{index + 1}</span>
          <span className="flex min-w-0 items-center gap-2">
            <Avatar className="size-6 shrink-0">
              <AvatarFallback className="text-[10px]">{initialsFor(row.name)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{row.name}</span>
          </span>
          <span className="text-right tabular-nums text-muted-foreground">{row.contactsTouched}</span>
          <span className="text-right tabular-nums text-muted-foreground">{row.callsBooked}</span>
          <span className="text-right tabular-nums font-medium">{row.dealsWon}</span>
        </div>
      ))}
    </div>
  );
}
