import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const [{ data: memberships }, { data: notifications }] = await Promise.all([
    supabase.from("organization_members").select("organization:organizations(id, name)").eq("user_id", appUser.id),
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", appUser.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const organizations = (memberships ?? [])
    .map((m) => m.organization)
    .filter((org): org is { id: string; name: string } => org !== null);

  return (
    <AppShell
      userId={appUser.id}
      userName={appUser.full_name ?? appUser.email}
      userEmail={appUser.email}
      organizations={organizations}
      activeOrgId={appUser.organization_id!}
      initialNotifications={notifications ?? []}
    >
      {children}
    </AppShell>
  );
}
