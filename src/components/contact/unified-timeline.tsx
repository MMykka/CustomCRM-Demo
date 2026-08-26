"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { StickyNote, Phone, Mail, MessageSquare, Users, ArrowRightLeft, CheckCircle2, FileText, Repeat, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TimelineEvent, TimelineEventType } from "@/lib/timeline";

const TYPE_ICONS: Record<TimelineEventType, typeof StickyNote> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  sms: MessageSquare,
  meeting: Users,
  stage_change: ArrowRightLeft,
  task_completed: CheckCircle2,
  form_submission: FileText,
  sequence_enrolled: Repeat,
  sequence_completed: Repeat,
  other: Circle,
};

const FILTERS: { key: string; label: string; types: TimelineEventType[] }[] = [
  { key: "all", label: "All", types: [] },
  { key: "note", label: "Notes", types: ["note"] },
  { key: "call", label: "Calls", types: ["call"] },
  { key: "email", label: "Emails", types: ["email"] },
  { key: "sms", label: "SMS", types: ["sms"] },
  { key: "meeting", label: "Meetings", types: ["meeting"] },
  { key: "stage_change", label: "Stage changes", types: ["stage_change"] },
  { key: "sequence", label: "Sequences", types: ["sequence_enrolled", "sequence_completed"] },
  { key: "form_submission", label: "Forms", types: ["form_submission"] },
];

function eventSummary(event: TimelineEvent) {
  const metadata = event.metadata;
  if (event.type === "call" && typeof metadata.outcome === "string") {
    const minutes = typeof metadata.duration_seconds === "number" ? Math.round(metadata.duration_seconds / 60) : null;
    return `${String(metadata.outcome).replace("_", " ")}${minutes ? ` · ${minutes}m` : ""}`;
  }
  if (event.type === "meeting" && typeof metadata.duration_minutes === "number") {
    return `${metadata.duration_minutes}m`;
  }
  return null;
}

export function UnifiedTimeline({ events }: { events: TimelineEvent[] }) {
  const [filterKey, setFilterKey] = useState("all");
  const presentTypes = new Set(events.map((e) => e.type));
  const activeFilter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0]!;
  const visible = activeFilter.key === "all" ? events : events.filter((e) => activeFilter.types.includes(e.type));
  const visibleFilters = FILTERS.filter((f) => f.key === "all" || f.types.some((t) => presentTypes.has(t)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5">
        {visibleFilters.map((f) => (
          <Button key={f.key} variant={filterKey === f.key ? "secondary" : "ghost"} size="xs" onClick={() => setFilterKey(f.key)}>
            {f.label}
          </Button>
        ))}
      </div>

      <ol className="flex flex-col gap-4">
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          visible.map((event) => {
            const Icon = TYPE_ICONS[event.type] ?? Circle;
            const summary = eventSummary(event);
            return (
              <li key={event.id} className="flex gap-3">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="size-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    {event.actor ? <span className="font-medium">{event.actor}</span> : null}{" "}
                    <span className="text-muted-foreground">{event.title}</span>
                  </p>
                  {summary ? <p className="text-xs font-medium capitalize">{summary}</p> : null}
                  {event.body ? <p className="whitespace-pre-line text-sm">{event.body}</p> : null}
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(event.occurredAt), { addSuffix: true })}</p>
                </div>
              </li>
            );
          })
        )}
      </ol>
    </div>
  );
}
