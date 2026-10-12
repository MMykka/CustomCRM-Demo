import { after } from "next/server";
import { json, notFound, parseBody, preflight, withApi } from "@/lib/api/v1/http";
import { WriteContext, emitContactEvents, getContact, normalizeContactInput, updateContact } from "@/lib/api/v1/contacts";
import { createAdminClient } from "@/lib/supabase/admin";

export const OPTIONS = preflight;

// GET /api/v1/contacts/:id
export const GET = withApi<{ id: string }>(async (_req, { organizationId }, { id }) => {
  const contact = await getContact(createAdminClient(), organizationId, id);
  if (!contact) throw notFound("Contact");
  return json({ data: contact });
});

// PATCH /api/v1/contacts/:id -- partial update: only the fields sent change,
// and an explicit null clears a field. tags adds, remove_tags removes.
const update = withApi<{ id: string }>(async (req, { organizationId, apiKeyName }, { id }) => {
  const { data, isForm } = await parseBody(req);
  const input = normalizeContactInput(data, isForm);
  const wc = new WriteContext(organizationId);
  await updateContact(wc, id, input, { isForm, apiKeyName });
  after(() => emitContactEvents(organizationId, wc.events));
  return json({ data: await getContact(wc.supabase, organizationId, id), meta: { ignored_fields: Object.keys(input.extra) } });
});

export const PATCH = update;
// PUT behaves like PATCH: some no-code tools only offer PUT for updates.
export const PUT = update;

// DELETE /api/v1/contacts/:id -- permanent; cascades to the contact's
// timeline, notes, tags and files.
export const DELETE = withApi<{ id: string }>(async (_req, { organizationId }, { id }) => {
  const supabase = createAdminClient();
  const snapshot = await getContact(supabase, organizationId, id);
  if (!snapshot) throw notFound("Contact");

  const { error } = await supabase.from("contacts").delete().eq("organization_id", organizationId).eq("id", snapshot.id);
  if (error) throw error;
  // custom_field_values has no FK to contacts (it's polymorphic), so clean up explicitly.
  await supabase.from("custom_field_values").delete().eq("organization_id", organizationId).eq("entity_type", "contact").eq("entity_id", snapshot.id);

  after(() => emitContactEvents(organizationId, [{ event: "contact.deleted", contactId: snapshot.id, snapshot }]));
  return json({ data: { id: snapshot.id, object: "contact", deleted: true } });
});
