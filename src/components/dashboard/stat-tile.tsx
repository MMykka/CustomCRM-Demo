import { Card, CardContent } from "@/components/ui/card";

export type StatTileAccent = "blue" | "neutral";

export function StatTile({
  label,
  value,
  hint,
  accent = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: StatTileAccent;
}) {
  return (
    <Card className={`py-4 ${accent === "blue" ? "border-l-2 border-l-brand-blue-foreground" : ""}`}>
      <CardContent className="flex flex-col gap-1 px-4">
        <p className={`text-xs font-medium uppercase ${accent === "blue" ? "text-brand-blue-foreground" : "text-muted-foreground"}`}>{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
