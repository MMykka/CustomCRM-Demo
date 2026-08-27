"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TasksViewToggle({ view }: { view: "myday" | "all" }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setView(next: "myday" | "all") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "myday") params.delete("view");
    else params.set("view", "all");
    router.push(`/tasks${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border p-0.5">
      <Button variant={view === "myday" ? "secondary" : "ghost"} size="sm" onClick={() => setView("myday")}>
        <CalendarClock className="size-4" />
        My Day
      </Button>
      <Button variant={view === "all" ? "secondary" : "ghost"} size="sm" onClick={() => setView("all")}>
        <List className="size-4" />
        All Tasks
      </Button>
    </div>
  );
}
