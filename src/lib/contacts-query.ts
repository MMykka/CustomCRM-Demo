import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const CONTACTS_PAGE_SIZE = 50;

export type ContactsSort = "created_desc" | "created_asc" | "score_desc" | "score_asc" | "name_asc" | "name_desc";

export type ContactsFilters = {
  q: string;
  tagIds: string[];
  ownerIds: string[];
  stages: string[];
  sources: string[];
  dateFrom: string | null;
  dateTo: string | null;
  sort: ContactsSort;
  page: number;
};

const SORT_MAP: Record<ContactsSort, { column: string; ascending: boolean }> = {
  created_desc: { column: "created_at", ascending: false },
  created_asc: { column: "created_at", ascending: true },
  score_desc: { column: "lead_score", ascending: false },
  score_asc: { column: "lead_score", ascending: true },
  name_asc: { column: "first_name", ascending: true },
  name_desc: { column: "first_name", ascending: false },
};

function parseCsv(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? raw.split(",").filter(Boolean) : [];
}

export function parseContactsFilters(searchParams: Record<string, string | string[] | undefined>): ContactsFilters {
  const sort = typeof searchParams.sort === "string" && searchParams.sort in SORT_MAP ? (searchParams.sort as ContactsSort) : "created_desc";

  return {
    q: typeof searchParams.q === "string" ? searchParams.q : "",
    tagIds: parseCsv(searchParams.tags),
    ownerIds: parseCsv(searchParams.owners),
    stages: parseCsv(searchParams.stages),
    sources: parseCsv(searchParams.sources),
    dateFrom: typeof searchParams.from === "string" ? searchParams.from : null,
    dateTo: typeof searchParams.to === "string" ? searchParams.to : null,
    sort,
    page: Math.max(1, Number(searchParams.page) || 1),
  };
}

// Serializes filters back into a URL search-param bundle -- this is also
// the shape stored in saved_views.filters, so applying a saved view is
// just a navigation to /contacts?<these params>.
export function contactsFiltersToSearchParams(filters: Partial<ContactsFilters>): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.tagIds?.length) params.set("tags", filters.tagIds.join(","));
  if (filters.ownerIds?.length) params.set("owners", filters.ownerIds.join(","));
  if (filters.stages?.length) params.set("stages", filters.stages.join(","));
  if (filters.sources?.length) params.set("sources", filters.sources.join(","));
  if (filters.dateFrom) params.set("from", filters.dateFrom);
  if (filters.dateTo) params.set("to", filters.dateTo);
  if (filters.sort && filters.sort !== "created_desc") params.set("sort", filters.sort);
  return params;
}

export async function queryContacts(supabase: SupabaseClient<Database>, filters: ContactsFilters) {
  let contactIdScope: string[] | null = null;

  if (filters.tagIds.length > 0) {
    const { data } = await supabase.from("contact_tags").select("contact_id").in("tag_id", filters.tagIds);
    contactIdScope = [...new Set((data ?? []).map((r) => r.contact_id))];
    if (contactIdScope.length === 0) return { rows: [], totalCount: 0 };
  }

  let query = supabase
    .from("contacts")
    .select("*, company:companies(id, name), owner:users(id, full_name, email), contact_tags(tags(*))", { count: "exact" });

  const q = filters.q.trim().replace(/[,()]/g, " ");
  if (q) {
    query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }
  if (filters.ownerIds.length) query = query.in("owner_id", filters.ownerIds);
  if (filters.stages.length) query = query.in("lifecycle_stage", filters.stages);
  if (filters.sources.length) query = query.in("source", filters.sources);
  if (filters.dateFrom) query = query.gte("created_at", filters.dateFrom);
  if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59`);
  if (contactIdScope !== null) query = query.in("id", contactIdScope);

  const sort = SORT_MAP[filters.sort];
  query = query.order(sort.column, { ascending: sort.ascending });

  const from = (filters.page - 1) * CONTACTS_PAGE_SIZE;
  const to = from + CONTACTS_PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;

  return { rows: data ?? [], totalCount: count ?? 0 };
}
