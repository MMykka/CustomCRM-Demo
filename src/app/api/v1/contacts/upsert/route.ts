import { after } from "next/server";
import { ApiError, badRequest, formRedirectTarget, json, parseBody, preflight, redirect, withApi } from "@/lib/api/v1/http";
import { MAX_BATCH_SIZE, WriteContext, emitContactEvents, getContact, normalizeContactInput, upsertContact } from "@/lib/api/v1/contacts";

export const OPTIONS = preflight;

// Rows of a batch run a few at a time: fast enough for 100 rows inside a
// serverless timeout without flooding the DB connection pool.
const BATCH_CONCURRENCY = 5;

// POST /api/v1/contacts/upsert -- create-or-update matched by id ->
// external_id -> email -> phone. Body is either one contact object, or
// { "contacts": [ ... ] } with up to 100 contacts. This is the endpoint
// website forms, Zapier/Make/n8n and sync jobs should normally use.
export const POST = withApi(async (req, { organizationId, apiKeyName }) => {
  const { data, isForm } = await parseBody(req);
  const wc = new WriteContext(organizationId);
  const opts = { isForm, apiKeyName };

  if (Array.isArray(data.contacts) || Array.isArray(data)) {
    const items = (Array.isArray(data) ? data : data.contacts) as unknown[];
    if (!items.length) throw badRequest("contacts must contain at least one contact");
    if (items.length > MAX_BATCH_SIZE) throw badRequest(`contacts can contain at most ${MAX_BATCH_SIZE} contacts per request`);

    const results: Record<string, unknown>[] = new Array(items.length);
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const index = next++;
        try {
          const input = normalizeContactInput(items[index] as Record<string, unknown>, false);
          if (input.honeypot) {
            results[index] = { index, status: "ignored" };
            continue;
          }
          const r = await upsertContact(wc, input, opts);
          results[index] = { index, status: r.created ? "created" : "updated", id: r.id, matched_by: r.matchedBy };
        } catch (err) {
          const e = err instanceof ApiError ? err : new ApiError(500, "internal_error", "Something went wrong");
          if (!(err instanceof ApiError)) console.error("Public API v1 batch upsert row failed", err);
          results[index] = { index, status: "error", error: { code: e.code, message: e.message, ...(e.details !== undefined ? { details: e.details } : {}) } };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, items.length) }, worker));
    after(() => emitContactEvents(organizationId, wc.events));

    const count = (s: string) => results.filter((r) => r.status === s).length;
    return json({
      object: "batch_result",
      data: results,
      meta: { total: items.length, created: count("created"), updated: count("updated"), failed: count("error"), ignored: count("ignored") },
    });
  }

  const input = normalizeContactInput(data, isForm);
  const target = isForm ? formRedirectTarget(req, data) : null;
  if (input.honeypot) return target ? redirect(target) : json({ data: null, meta: { ignored: true } }, 202);

  const result = await upsertContact(wc, input, opts);
  after(() => emitContactEvents(organizationId, wc.events));

  if (target) return redirect(target);
  return json(
    {
      data: await getContact(wc.supabase, organizationId, result.id),
      meta: { created: result.created, matched_by: result.matchedBy, ignored_fields: Object.keys(input.extra) },
    },
    result.created ? 201 : 200,
  );
});
