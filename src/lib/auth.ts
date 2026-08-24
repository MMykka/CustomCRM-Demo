import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const { data: appUser, error } = await supabase.from("users").select("*").eq("id", user.id).single();

  if (error || !appUser) {
    redirect("/login");
  }

  if (!appUser.organization_id) {
    redirect("/onboarding");
  }

  return appUser;
}
