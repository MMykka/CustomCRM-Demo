import { Card, CardContent } from "@/components/ui/card";

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="py-4">
      <CardContent className="flex flex-col gap-1 px-4">
        <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
