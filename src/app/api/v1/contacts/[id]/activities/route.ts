import { badRequest, json, notFound, parseBody, preflight, withApi } from "@/lib/api/v1/http";
import { isUuid } from "@/lib/api/v1/contacts";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export const OPTIONS = preflight;

// stage_change / task_completed are written by the CRM itself, not callers.
const ACTIVITY_TYPES = ["note", "call", "email", "sms", "meeting", "form_submission", "other"] as const;
type ActivityType = (typeof ACTIVITY_TYPES)[number];

const serialize = (a: { id: string; type: string; body: string | null; metadata: Json; created_at: string; contact_id: string | null }) => ({
  id: a.id,
  object: "activity" as const,
  contact_id: a.contact_id,
  type: a.type,
  body: a.body,
  metadata: a.metadata,
  occurred_at: a.created_at,
});

async function requireContact(organizationId: string, id: string) {
  if (!isUuid(id)) throw notFound("Contact");
  const { data } = await createAdminClient().from("contacts").select("id").eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (!data) throw notFound("Contact");
}

// GET /api/v1/contacts/:id/activities -- the contact's timeline, newest first.
export const GET = withApi<{ id: string }>(async (req, { organizationId }, { id }) => {
  await requireContact(organizationId, id);
  const params = req.nextUrl.searchParams;
  const limit = params.has("limit") ? Number(params.get("limit")) : 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw badRequest("limit must be an integer from 1 to 100");

  let query = createAdminClient()
    .from("activities")
    .select("id, type, body, metadata, created_at, contact_id")
    .eq("organization_id", organizationId)
    .eq("contact_id", id);
  const before = params.get("before");
  if (before) {
    if (Number.isNaN(new Date(before).getTime())) throw badRequest("before must be an ISO 8601 date/time");
    query = query.lt("created_at", new Date(before).toISOString());
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit + 1);
  if (error) throw error;
  const rows = data ?? [];
  const page = rows.slice(0, limit);
  return json({ object: "list", data: page.map(serialize), has_more: rows.length > limit, next_before: rows.length > limit ? page.at(-1)!.created_at : null });
});

// POST /api/v1/contacts/:id/activities -- log something that happened
// (a call, an email sent by another tool, a form submission...) onto the
// contact's timeline.
export const POST = withApi<{ id: string }>(async (req, { organizationId, apiKeyName }, { id }) => {
  await requireContact(organizationId, id);
  const { data } = await parseBody(req);

  const type = (typeof data.type === "string" ? data.type.trim().toLowerCase() : "note") as ActivityType;
  if (!ACTIVITY_TYPES.includes(type)) throw badRequest(`type must be one of: ${ACTIVITY_TYPES.join(", ")}`);
  const body = typeof data.body === "string" ? data.body.trim() : "";
  if (!body) throw badRequest("body is required");
  if (body.length > 20000) throw badRequest("body must be at most 20000 characters");

  let metadata: Record<string, Json> = {};
  if (data.metadata !== undefined && data.metadata !== null) {
    if (typeof data.metadata !== "object" || Array.isArray(data.metadata)) throw badRequest("metadata must be an object");
    metadata = data.metadata as Record<string, Json>;
    if (JSON.stringify(metadata).length > 20000) throw badRequest("metadata is too large (max 20KB)");
  }

  let occurredAt: string | undefined;
  if (data.occurred_at !== undefined) {
    const d = new Date(String(data.occurred_at));
    if (Number.isNaN(d.getTime())) throw badRequest("occurred_at must be an ISO 8601 date/time");
    occurredAt = d.toISOString();
  }

  const { data: row, error } = await createAdminClient()
    .from("activities")
    .insert({
      organization_id: organizationId,
      contact_id: id,
      type,
      body,
      metadata: { ...metadata, via: "api_v1", api_key: apiKeyName },
      ...(occurredAt ? { created_at: occurredAt } : {}),
    })
    .select("id, type, body, metadata, created_at, contact_id")
    .single();
  if (error) throw error;

  return json({ data: serialize(row) }, 201);
});
