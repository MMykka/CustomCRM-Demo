"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

const PAGE_SIZE = 50;

export async function listAuditLogTables() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_log")
    .select("table_name")
    .eq("organization_id", appUser.organization_id!);

  if (error) throw error;
  return [...new Set((data ?? []).map((row) => row.table_name))].sort();
}

export async function listAuditLog(input: { tableName?: string; before?: string } = {}) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  // audit_log.changed_by has no FK (it's written by a trigger and can
  // reference a row that's since been deleted), so actors are resolved
  // with a second lookup instead of a PostgREST embedded join.
  let query = supabase
    .from("audit_log")
    .select("*")
    .eq("organization_id", appUser.organization_id!)
    .order("changed_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (input.tableName) query = query.eq("table_name", input.tableName);
  if (input.before) query = query.lt("changed_at", input.before);

  const { data, error } = await query;
  if (error) throw error;

  const actorIds = [...new Set((data ?? []).map((row) => row.changed_by).filter((id): id is string => id !== null))];
  const { data: actors } = actorIds.length
    ? await supabase.from("users").select("id, full_name, email").in("id", actorIds)
    : { data: [] };
  const actorsById = new Map((actors ?? []).map((actor) => [actor.id, actor]));

  return (data ?? []).map((row) => ({ ...row, actor: row.changed_by ? (actorsById.get(row.changed_by) ?? null) : null }));
}
