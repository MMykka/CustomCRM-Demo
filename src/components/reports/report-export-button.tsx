"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";

export function ReportExportButton({ filename, rows }: { filename: string; rows: Record<string, unknown>[] }) {
  return (
    <Button variant="outline" size="sm" disabled={rows.length === 0} onClick={() => downloadCsv(filename, rows)}>
      <Download className="size-4" />
      Export
    </Button>
  );
}
