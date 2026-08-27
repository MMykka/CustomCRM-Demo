import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { STALE_DAYS } from "@/lib/pipeline-filters";

export const DEALS_PAGE_SIZE = 50;

export type DealsSort = "created_desc" | "created_asc" | "value_desc" | "value_asc" | "close_date_asc" | "close_date_desc";

export type DealsStatus = "open" | "won" | "lost" | "all";

export type DealsFilters = {
  q: string;
  pipelineId: string | null;
  stageIds: string[];
  ownerIds: string[];
  valueMin: number | null;
  valueMax: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  staleOnly: boolean;
  status: DealsStatus;
  sort: DealsSort;
  page: number;
};

const SORT_MAP: Record<DealsSort, { column: string; ascending: boolean }> = {
  created_desc: { column: "created_at", ascending: false },
  created_asc: { column: "created_at", ascending: true },
  value_desc: { column: "value", ascending: false },
  value_asc: { column: "value", ascending: true },
  close_date_asc: { column: "expected_close_date", ascending: true },
  close_date_desc: { column: "expected_close_date", ascending: false },
};

function parseCsv(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? raw.split(",").filter(Boolean) : [];
}

export function parseDealsFilters(searchParams: Record<string, string | string[] | undefined>): DealsFilters {
  const sort = typeof searchParams.sort === "string" && searchParams.sort in SORT_MAP ? (searchParams.sort as DealsSort) : "created_desc";
  const status = typeof searchParams.status === "string" && ["open", "won", "lost", "all"].includes(searchParams.status) ? (searchParams.status as DealsStatus) : "open";

  return {
    q: typeof searchParams.q === "string" ? searchParams.q : "",
    pipelineId: typeof searchParams.pipeline === "string" ? searchParams.pipeline : null,
    stageIds: parseCsv(searchParams.stage),
    ownerIds: parseCsv(searchParams.owner),
    valueMin: searchParams.value_min ? Number(searchParams.value_min) : null,
    valueMax: searchParams.value_max ? Number(searchParams.value_max) : null,
    dateFrom: typeof searchParams.from === "string" ? searchParams.from : null,
    dateTo: typeof searchParams.to === "string" ? searchParams.to : null,
    staleOnly: searchParams.stale === "1",
    status,
    sort,
    page: Math.max(1, Number(searchParams.page) || 1),
  };
}

// Serializes filters back into a URL search-param bundle -- also the shape
// stored in saved_views.filters, matching contacts-query.ts's convention.
export function dealsFiltersToSearchParams(filters: Partial<DealsFilters>): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.pipelineId) params.set("pipeline", filters.pipelineId);
  if (filters.stageIds?.length) params.set("stage", filters.stageIds.join(","));
  if (filters.ownerIds?.length) params.set("owner", filters.ownerIds.join(","));
  if (filters.valueMin !== null && filters.valueMin !== undefined) params.set("value_min", String(filters.valueMin));
  if (filters.valueMax !== null && filters.valueMax !== undefined) params.set("value_max", String(filters.valueMax));
  if (filters.dateFrom) params.set("from", filters.dateFrom);
  if (filters.dateTo) params.set("to", filters.dateTo);
  if (filters.staleOnly) params.set("stale", "1");
  if (filters.status && filters.status !== "open") params.set("status", filters.status);
  if (filters.sort && filters.sort !== "created_desc") params.set("sort", filters.sort);
  return params;
}

export async function queryDeals(supabase: SupabaseClient<Database>, filters: DealsFilters, pageSize: number = DEALS_PAGE_SIZE) {
  let query = supabase
    .from("deals")
    .select(
      "*, contact:contacts(id, first_name, last_name, email), company:companies(id, name), owner:users(id, full_name, email), stage:stages(id, name, color), pipeline:pipelines(id, name)",
      { count: "exact" },
    );

  const q = filters.q.trim().replace(/[,()]/g, " ");
  if (q) query = query.ilike("title", `%${q}%`);
  if (filters.pipelineId) query = query.eq("pipeline_id", filters.pipelineId);
  if (filters.stageIds.length) query = query.in("stage_id", filters.stageIds);
  if (filters.ownerIds.length) query = query.in("owner_id", filters.ownerIds);
  if (filters.valueMin !== null) query = query.gte("value", filters.valueMin);
  if (filters.valueMax !== null) query = query.lte("value", filters.valueMax);
  if (filters.dateFrom) query = query.gte("expected_close_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("expected_close_date", filters.dateTo);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.staleOnly) {
    const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    query = query.lt("updated_at", cutoff);
  }

  const sort = SORT_MAP[filters.sort];
  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false });

  const from = (filters.page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return { rows: data ?? [], totalCount: count ?? 0 };
}
