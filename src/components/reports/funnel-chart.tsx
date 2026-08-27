"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LIFECYCLE_STAGE_LABELS, type LifecycleStage } from "@/lib/types";
import type { FunnelResult } from "@/lib/reports-funnel";

const LIFECYCLE_STAGES: LifecycleStage[] = ["subscriber", "lead", "mql", "sql", "opportunity", "customer", "evangelist", "other"];

// Reuses the theme's existing 5-step blue chart ramp (--chart-1..5),
// cycled for the 8 lifecycle stages, rather than introducing new colors.
const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function FunnelChart({ data, fieldLabel }: { data: FunnelResult; fieldLabel: string }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data.buckets} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <Tooltip
          cursor={{ className: "fill-muted" }}
          contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {LIFECYCLE_STAGES.map((stage, index) => (
          <Bar
            key={stage}
            dataKey={stage}
            name={LIFECYCLE_STAGE_LABELS[stage]}
            stackId={fieldLabel}
            fill={CHART_COLORS[index % CHART_COLORS.length]}
            radius={index === LIFECYCLE_STAGES.length - 1 ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
