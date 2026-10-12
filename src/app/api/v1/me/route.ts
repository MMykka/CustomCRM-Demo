import { json, preflight, withApi } from "@/lib/api/v1/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const OPTIONS = preflight;

// GET /api/v1/me -- "test connection" endpoint: confirms the key works and
// which organization it belongs to (what Zapier/Make auth tests call).
export const GET = withApi(async (_req, { organizationId, apiKeyId, apiKeyName }) => {
  const { data, error } = await createAdminClient().from("organizations").select("id, name").eq("id", organizationId).single();
  if (error) throw error;
  return json({ data: { organization: { id: data.id, name: data.name }, api_key: { id: apiKeyId, name: apiKeyName } } });
});
