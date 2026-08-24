import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { KanbanBoard } from "@/components/pipeline/kanban-board";

export default async function PipelinePage() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data: pipeline } = await supabase
    .from("pipelines")
    .select("*")
    .eq("organization_id", appUser.organization_id!)
    .order("is_default", { ascending: false })
    .order("position")
    .limit(1)
    .single();

  if (!pipeline) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">No pipeline found yet.</p>
      </div>
    );
  }

  const [{ data: stages }, { data: deals }] = await Promise.all([
    supabase.from("stages").select("*").eq("pipeline_id", pipeline.id).order("position"),
    supabase
      .from("deals")
      .select("*, contact:contacts(id, first_name, last_name, email), owner:users(id, full_name, email)")
      .eq("pipeline_id", pipeline.id)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="flex h-screen flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{pipeline.name}</h1>
        <p className="text-sm text-muted-foreground">{deals?.length ?? 0} open deals</p>
      </div>
      <KanbanBoard pipelineId={pipeline.id} stages={stages ?? []} initialDeals={deals ?? []} />
    </div>
  );
}
