"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAppUser, requireOrgRole } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export async function listTeamMembers() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_members")
    .select("*, user:users!organization_members_user_id_fkey(id, full_name, email, avatar_url)")
    .eq("organization_id", appUser.organization_id!)
    .order("role")
    .order("created_at");

  if (error) throw error;
  return data ?? [];
}

export async function inviteTeamMember(email: string, role: UserRole): Promise<{ error: string | null }> {
  const appUser = await requireAppUser();
  requireOrgRole(appUser, ["owner", "admin"]);

  const admin = createAdminClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { invited_org_id: appUser.organization_id, invited_role: role, invited_by: appUser.id },
    redirectTo: `${origin}/accept-invite`,
  });

  if (error) return { error: error.message };

  revalidatePath("/settings/members");
  return { error: null };
}

export async function changeTeamMemberRole(memberUserId: string, role: UserRole) {
  const appUser = await requireAppUser();
  requireOrgRole(appUser, ["owner", "admin"]);
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_member_role", { target_user_id: memberUserId, new_role: role });
  if (error) throw error;

  revalidatePath("/settings/members");
}

export async function deactivateTeamMember(memberUserId: string) {
  const appUser = await requireAppUser();
  requireOrgRole(appUser, ["owner", "admin"]);
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_member_status", { target_user_id: memberUserId, new_status: "deactivated" });
  if (error) throw error;

  revalidatePath("/settings/members");
}

export async function reactivateTeamMember(memberUserId: string) {
  const appUser = await requireAppUser();
  requireOrgRole(appUser, ["owner", "admin"]);
  const supabase = await createClient();

  const { error } = await supabase.rpc("set_member_status", { target_user_id: memberUserId, new_status: "active" });
  if (error) throw error;

  revalidatePath("/settings/members");
}
