import { requireAppUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TwoFactorSettings } from "@/components/settings/two-factor-settings";

export default async function SecuritySettingsPage() {
  await requireAppUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
        <CardDescription>Add a second step when signing in, using an authenticator app.</CardDescription>
      </CardHeader>
      <CardContent>
        <TwoFactorSettings />
      </CardContent>
    </Card>
  );
}
