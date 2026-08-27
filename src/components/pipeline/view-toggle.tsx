"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ViewToggle({ view }: { view: "kanban" | "list" }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setView(next: "kanban" | "list") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "kanban") params.delete("view");
    else params.set("view", "list");
    router.push(`/pipeline${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border p-0.5">
      <Button variant={view === "kanban" ? "secondary" : "ghost"} size="sm" onClick={() => setView("kanban")}>
        <LayoutGrid className="size-4" />
        Board
      </Button>
      <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setView("list")}>
        <List className="size-4" />
        List
      </Button>
    </div>
  );
}
