import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TeamMembersTable } from "@/components/settings/team-members-table";
import { listTeamMembers } from "@/lib/actions/team-members";
import { requireAppUser } from "@/lib/auth";

export default async function MembersPage() {
  const appUser = await requireAppUser();
  const members = await listTeamMembers();
  const canManage = appUser.role === "owner" || appUser.role === "admin";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>People with access to this organization.</CardDescription>
      </CardHeader>
      <CardContent>
        <TeamMembersTable members={members} currentUserId={appUser.id} canManage={canManage} />
      </CardContent>
    </Card>
  );
}
