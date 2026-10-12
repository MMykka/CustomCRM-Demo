import { json, preflight, withApi } from "@/lib/api/v1/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const OPTIONS = preflight;

// GET /api/v1/tags -- the org's tags, for building pickers in integrations.
export const GET = withApi(async (_req, { organizationId }) => {
  const { data, error } = await createAdminClient().from("tags").select("id, name, color, created_at").eq("organization_id", organizationId).order("name").limit(1000);
  if (error) throw error;
  return json({ object: "list", data: (data ?? []).map((t) => ({ object: "tag", ...t })) });
});
