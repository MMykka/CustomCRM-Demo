import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type StatTileAccent = "blue" | "yellow" | "neutral";

const ACCENT_BADGE_CLASSES: Record<StatTileAccent, string> = {
  blue: "bg-brand-blue text-brand-blue-foreground",
  yellow: "bg-brand-yellow text-brand-yellow-foreground",
  neutral: "bg-muted text-muted-foreground",
};

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent = "neutral",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: StatTileAccent;
  href?: string;
}) {
  const card = (
    <Card className="py-4 transition-shadow hover:shadow-md">
      <CardContent className="flex items-start justify-between gap-3 px-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
          <p className="text-3xl font-semibold tracking-tight">{value}</p>
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${ACCENT_BADGE_CLASSES[accent]}`}>
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}
