import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

// Fetches the current authenticated user's public.users row (email, role,
// organization_id, ...). Redirects to /login if there is no session, and to
// /onboarding if the user hasn't created/joined an organization yet.
export async function requireAppUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Password auth alone only reaches aal1. If this account has a verified
  // TOTP factor enrolled, every protected route stays gated here until the
  // second factor is verified (see /mfa-challenge and signIn() in
  // src/lib/actions/auth.ts) -- this is the actual enforcement point, since
  // it runs on every server-rendered request, not just at login time.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
    redirect("/mfa-challenge");
  }

  const { data: appUser, error } = await supabase.from("users").select("*").eq("id", user.id).single();

  if (error || !appUser) {
    redirect("/login");
  }

  if (!appUser.organization_id) {
    redirect("/onboarding");
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("status")
    .eq("organization_id", appUser.organization_id)
    .eq("user_id", appUser.id)
    .single();

  if (membership?.status === "deactivated") {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return appUser;
}

// Throws if the current user's role in their active org isn't one of
// `allowedRoles` -- for gating admin-only server actions (invite, role
// change, deactivate, revoke API key, ...).
export function requireOrgRole(appUser: { role: string }, allowedRoles: UserRole[]) {
  if (!allowedRoles.includes(appUser.role as UserRole)) {
    throw new Error("Not authorized");
  }
}
