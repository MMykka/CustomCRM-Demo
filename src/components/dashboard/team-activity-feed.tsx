import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Circle } from "lucide-react";
import { TIMELINE_TYPE_ICONS } from "@/lib/timeline-icons";
import type { TeamFeedItem } from "@/lib/dashboard-feed";

export function TeamActivityFeed({ items }: { items: TeamFeedItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No team activity yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {items.map((item) => {
        const Icon = TIMELINE_TYPE_ICONS[item.type] ?? Circle;
        return (
          <li key={item.id} className="flex gap-3">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="size-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                {item.actor ? <span className="font-medium">{item.actor}</span> : <span className="text-muted-foreground">Someone</span>}{" "}
                <span className="text-muted-foreground">{item.title.toLowerCase()}</span>
                {item.contact ? (
                  <>
                    {" for "}
                    <Link href={`/contacts/${item.contact.id}`} className="font-medium hover:underline">
                      {item.contact.name}
                    </Link>
                  </>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true })}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
