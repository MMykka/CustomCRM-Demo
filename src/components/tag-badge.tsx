import { Badge } from "@/components/ui/badge";

export function TagBadge({ name, color }: { name: string; color: string }) {
  return (
    <Badge
      variant="outline"
      className="gap-1.5 font-normal"
      style={{ borderColor: color, color }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </Badge>
  );
}
