import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RenameOrgForm } from "@/components/settings/rename-org-form";
import { CreateOrgForm } from "@/components/settings/create-org-form";
import { OrgLogoUpload } from "@/components/settings/org-logo-upload";
import { OrgProfileForm } from "@/components/settings/org-profile-form";
import type { BusinessHours } from "@/lib/actions/organizations";

export default async function SettingsPage() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data: organization } = await supabase.from("organizations").select("*").eq("id", appUser.organization_id!).single();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>The workspace name and branding shown across The Hub.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <OrgLogoUpload organizationId={appUser.organization_id!} orgName={organization?.name ?? ""} logoUrl={organization?.logo_url ?? null} />
          <RenameOrgForm currentName={organization?.name ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hours</CardTitle>
          <CardDescription>Timezone, business hours, and quiet hours used to schedule sends and calls.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrgProfileForm
            timezone={organization?.timezone ?? "UTC"}
            businessHours={(organization?.business_hours as BusinessHours | null) ?? null}
            quietHours={(organization?.quiet_hours as BusinessHours | null) ?? null}
          />
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
