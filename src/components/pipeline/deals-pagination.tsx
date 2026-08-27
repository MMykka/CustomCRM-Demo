"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DealsPagination({ page, pageSize, totalCount }: { page: number; pageSize: number; totalCount: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function goTo(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    router.push(`/pipeline${params.toString() ? `?${params.toString()}` : ""}`);
  }

  if (totalCount === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {from}-{to} of {totalCount}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => goTo(page - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="px-2">
          Page {page} of {totalPages}
        </span>
        <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => goTo(page + 1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
