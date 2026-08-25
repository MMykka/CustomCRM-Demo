import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RenameOrgForm } from "@/components/settings/rename-org-form";
import { CreateOrgForm } from "@/components/settings/create-org-form";
import { initialsFor } from "@/lib/types";

export default async function SettingsPage() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const [{ data: organization }, { data: members }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", appUser.organization_id!).single(),
    supabase
      .from("organization_members")
      .select("*, user:users(id, full_name, email, avatar_url)")
      .eq("organization_id", appUser.organization_id!)
      .order("created_at"),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>The workspace name shown across The Hub.</CardDescription>
        </CardHeader>
        <CardContent>
          <RenameOrgForm currentName={organization?.name ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>People with access to this organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {(members ?? []).map((member) => {
              const name = member.user?.full_name ?? member.user?.email ?? "Unknown";
              return (
                <li key={member.id} className="flex items-center gap-3 py-2.5">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">{initialsFor(name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{name}</p>
                    {member.user?.email ? <p className="text-xs text-muted-foreground">{member.user.email}</p> : null}
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {member.role}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create another organization</CardTitle>
          <CardDescription>Useful for demos or managing a client&apos;s workspace separately.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrgForm />
        </CardContent>
      </Card>
    </div>
  );
}
