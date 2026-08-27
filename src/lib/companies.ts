import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
}

// Looks up an existing company in the org whose domain matches the given
// email's domain (case-insensitive exact match). Never creates a company --
// only links to one that already exists.
export async function findCompanyIdForEmail(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  email: string | null,
): Promise<string | null> {
  if (!email) return null;
  const domain = extractDomain(email);
  if (!domain) return null;

  const { data } = await supabase.from("companies").select("id").eq("organization_id", organizationId).ilike("domain", domain).limit(1).maybeSingle();

  return data?.id ?? null;
}
