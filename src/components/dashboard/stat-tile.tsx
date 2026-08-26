import { Card, CardContent } from "@/components/ui/card";

const ACCENT_CARD_CLASSES = {
  blue: "bg-brand-blue",
  pink: "bg-brand-pink",
  yellow: "bg-brand-yellow",
  neutral: "",
} as const;

const ACCENT_LABEL_CLASSES = {
  blue: "text-brand-blue-foreground",
  pink: "text-brand-pink-foreground",
  yellow: "text-brand-yellow-foreground",
  neutral: "text-muted-foreground",
} as const;

export type StatTileAccent = keyof typeof ACCENT_CARD_CLASSES;

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
    <Card className={`py-4 ${ACCENT_CARD_CLASSES[accent]}`}>
      <CardContent className="flex flex-col gap-1 px-4">
        <p className={`text-xs font-medium uppercase ${ACCENT_LABEL_CLASSES[accent]}`}>{label}</p>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
