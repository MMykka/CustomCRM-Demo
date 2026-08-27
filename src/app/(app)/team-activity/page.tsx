import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { getTeamActivityFeed } from "@/lib/dashboard-feed";
import { TeamActivityFeed } from "@/components/dashboard/team-activity-feed";

const TEAM_ACTIVITY_LIMIT = 200;

export default async function TeamActivityPage() {
  await requireAppUser();
  const supabase = await createClient();
  const items = await getTeamActivityFeed(supabase, TEAM_ACTIVITY_LIMIT);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team activity</h1>
        <p className="text-sm text-muted-foreground">Most recent {items.length} events across the org.</p>
      </div>

      <TeamActivityFeed items={items} showAbsoluteDates />
    </div>
  );
}
