import { after } from "next/server";
import { badRequest, formRedirectTarget, json, parseBody, preflight, redirect, withApi } from "@/lib/api/v1/http";
import {
  CONTACT_SELECT,
  LIFECYCLE_STAGES,
  WriteContext,
  createContact,
  emitContactEvents,
  getContact,
  isUuid,
  normalizeContactInput,
  serializeContacts,
} from "@/lib/api/v1/contacts";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LifecycleStage } from "@/lib/types";

export const OPTIONS = preflight;

const MAX_LIMIT = 100;

function encodeCursor(value: string, id: string) {
  return Buffer.from(JSON.stringify([value, id])).toString("base64url");
}

function decodeCursor(cursor: string): [string, string] {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString());
    if (Array.isArray(parsed) && parsed.length === 2 && parsed.every((p) => typeof p === "string")) return parsed as [string, string];
  } catch {}
  throw badRequest("cursor is invalid; pass the next_cursor value from a previous response unchanged");
}

function isoParam(params: URLSearchParams, name: string): string | null {
  const raw = params.get(name);
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw badRequest(`${name} must be an ISO 8601 date/time`);
  return d.toISOString();
}

// GET /api/v1/contacts -- list/search with keyset (cursor) pagination, so
// paging through 1M contacts costs the same per page as through 100.
export const GET = withApi(async (req, { organizationId }) => {
  const params = req.nextUrl.searchParams;
  const supabase = createAdminClient();

  const limit = params.has("limit") ? Number(params.get("limit")) : 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw badRequest(`limit must be an integer from 1 to ${MAX_LIMIT}`);

  const sort = params.get("sort") ?? "created_at";
  if (sort !== "created_at" && sort !== "updated_at") throw badRequest("sort must be created_at or updated_at");
  const order = params.get("order") ?? "desc";
  if (order !== "asc" && order !== "desc") throw badRequest("order must be asc or desc");
  const ascending = order === "asc";

  // Filtering by tag uses a second, inner-joined alias of contact_tags so the
  // contact's full tag list still comes back in the normal embed.
  const tagNames = (params.get("tag") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  let tagIds: string[] = [];
  if (tagNames.length) {
    const { data, error } = await supabase.from("tags").select("id").eq("organization_id", organizationId).in("name", tagNames);
    if (error) throw error;
    tagIds = (data ?? []).map((t) => t.id);
    if (!tagIds.length) return json({ object: "list", data: [], has_more: false, next_cursor: null });
  }

  const select = tagIds.length ? `${CONTACT_SELECT}, tag_filter:contact_tags!inner(tag_id)` : CONTACT_SELECT;
  const includeTotal = params.get("include_total") === "true";
  let query = supabase
    .from("contacts")
    .select(select, includeTotal ? { count: "exact" } : undefined)
    .eq("organization_id", organizationId);

  if (tagIds.length) query = query.in("tag_filter.tag_id", tagIds);

  const email = params.get("email")?.trim().toLowerCase();
  if (email) query = query.eq("email", email);
  const phone = params.get("phone")?.replace(/[^0-9]/g, "");
  if (phone) query = query.eq("phone_normalized", phone);
  const externalId = params.get("external_id")?.trim();
  if (externalId) query = query.eq("external_id", externalId);
  const stage = params.get("lifecycle_stage")?.trim().toLowerCase();
  if (stage) {
    if (!LIFECYCLE_STAGES.includes(stage as LifecycleStage)) throw badRequest(`lifecycle_stage must be one of: ${LIFECYCLE_STAGES.join(", ")}`);
    query = query.eq("lifecycle_stage", stage);
  }
  for (const col of ["source", "campaign"] as const) {
    const v = params.get(col)?.trim();
    if (v) query = query.eq(col, v);
  }
  const companyId = params.get("company_id")?.trim();
  if (companyId) {
    if (!isUuid(companyId)) throw badRequest("company_id must be a UUID");
    query = query.eq("company_id", companyId);
  }

  const createdAfter = isoParam(params, "created_after");
  if (createdAfter) query = query.gte("created_at", createdAfter);
  const createdBefore = isoParam(params, "created_before");
  if (createdBefore) query = query.lt("created_at", createdBefore);
  const updatedSince = isoParam(params, "updated_since");
  if (updatedSince) query = query.gte("updated_at", updatedSince);

  // Free-text search over name/email/phone. PostgREST's or() syntax uses
  // , ( ) as delimiters, so strip them (and wildcards) from user input.
  const q = params.get("q")?.replace(/[,()"\\%*]/g, " ").trim();
  if (q) {
    const digits = q.replace(/[^0-9]/g, "");
    const clauses = [`first_name.ilike.*${q}*`, `last_name.ilike.*${q}*`, `email.ilike.*${q}*`];
    if (digits.length >= 3) clauses.push(`phone_normalized.like.*${digits}*`);
    const parts = q.split(/\s+/);
    if (parts.length >= 2) clauses.push(`and(first_name.ilike.*${parts[0]}*,last_name.ilike.*${parts.slice(1).join(" ")}*)`);
    query = query.or(clauses.join(","));
  }

  const cursor = params.get("cursor");
  if (cursor) {
    const [value, id] = decodeCursor(cursor);
    if (!isUuid(id) || Number.isNaN(new Date(value).getTime())) throw badRequest("cursor is invalid");
    const op = ascending ? "gt" : "lt";
    query = query.or(`${sort}.${op}."${value}",and(${sort}.eq."${value}",id.${op}.${id})`);
  }

  const { data, error, count } = await query
    .order(sort, { ascending })
    .order("id", { ascending })
    .limit(limit + 1);
  if (error) throw error;

  const rows = (data ?? []) as unknown as (Parameters<typeof serializeContacts>[2][number] & Record<string, string>)[];
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);

  return json({
    object: "list",
    data: await serializeContacts(supabase, organizationId, page),
    has_more: hasMore,
    next_cursor: hasMore && last ? encodeCursor(last[sort], last.id) : null,
    ...(includeTotal ? { total: count ?? 0 } : {}),
  });
});

// POST /api/v1/contacts -- create a contact; 409 if its email or external_id
// already exists (use POST /api/v1/contacts/upsert to create-or-update).
export const POST = withApi(async (req, { organizationId, apiKeyName }) => {
  const { data, isForm } = await parseBody(req);
  const input = normalizeContactInput(data, isForm);
  const target = isForm ? formRedirectTarget(req, data) : null;
  if (input.honeypot) return target ? redirect(target) : json({ data: null, meta: { ignored: true } }, 202);

  const wc = new WriteContext(organizationId);
  const id = await createContact(wc, input, { isForm, apiKeyName });
  after(() => emitContactEvents(organizationId, wc.events));

  if (target) return redirect(target);
  return json({ data: await getContact(wc.supabase, organizationId, id), meta: { created: true, ignored_fields: Object.keys(input.extra) } }, 201);
});
