import { after, type NextRequest } from "next/server";
import { badRequest, json, notFound, parseBody, preflight, withApi } from "@/lib/api/v1/http";
import { WriteContext, emitContactEvents, getContact, isUuid } from "@/lib/api/v1/contacts";

export const OPTIONS = preflight;

async function tagNames(req: NextRequest): Promise<string[]> {
  const fromQuery = req.nextUrl.searchParams.get("tags");
  const raw = fromQuery ?? (await parseBody(req)).data.tags;
  const items = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : [];
  const names = [...new Set(items.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean))];
  if (!names.length) throw badRequest('Send tags as { "tags": ["VIP", "Newsletter"] } or ?tags=VIP,Newsletter');
  if (names.some((n) => n.length > 100)) throw badRequest("Tag names must be at most 100 characters");
  return names;
}

async function requireContact(wc: WriteContext, id: string) {
  if (!isUuid(id)) throw notFound("Contact");
  const { data } = await wc.supabase.from("contacts").select("id").eq("organization_id", wc.organizationId).eq("id", id).maybeSingle();
  if (!data) throw notFound("Contact");
}

// POST /api/v1/contacts/:id/tags -- add tags (created if they don't exist yet).
export const POST = withApi<{ id: string }>(async (req, { organizationId }, { id }) => {
  const names = await tagNames(req);
  const wc = new WriteContext(organizationId);
  await requireContact(wc, id);

  const tagIds = await wc.tagIdsFor(names);
  const { error } = await wc.supabase
    .from("contact_tags")
    .upsert(
      tagIds.map((tag_id) => ({ contact_id: id, tag_id, organization_id: organizationId })),
      { onConflict: "contact_id,tag_id", ignoreDuplicates: true },
    );
  if (error) throw error;

  after(() => emitContactEvents(organizationId, [{ event: "contact.updated", contactId: id }]));
  return json({ data: await getContact(wc.supabase, organizationId, id) });
});

// DELETE /api/v1/contacts/:id/tags -- remove tags (the tags themselves stay).
export const DELETE = withApi<{ id: string }>(async (req, { organizationId }, { id }) => {
  const names = await tagNames(req);
  const wc = new WriteContext(organizationId);
  await requireContact(wc, id);

  const tagIds = await wc.existingTagIds(names);
  if (tagIds.length) {
    const { error } = await wc.supabase.from("contact_tags").delete().eq("organization_id", organizationId).eq("contact_id", id).in("tag_id", tagIds);
    if (error) throw error;
  }

  after(() => emitContactEvents(organizationId, [{ event: "contact.updated", contactId: id }]));
  return json({ data: await getContact(wc.supabase, organizationId, id) });
});
