import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Auth for src/app/api/public/** routes -- external callers (e.g. the Lead
// Nurture Workflow app) send `Authorization: Bearer hub_live_...`, the same
// plaintext key createApiKey() (src/lib/actions/api-keys.ts) handed them
// once at creation time. We only ever stored its sha256 hash, so we hash
// the incoming key the same way and compare against api_keys.key_hash.
export async function authenticateApiKey(req: NextRequest): Promise<{ organizationId: string } | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  const keyHash = createHash("sha256").update(token).digest("hex");
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, organization_id, revoked_at")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) return null;

  // Best-effort -- last_used_at is informational, never block the request on it.
  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);

  return { organizationId: data.organization_id };
}
