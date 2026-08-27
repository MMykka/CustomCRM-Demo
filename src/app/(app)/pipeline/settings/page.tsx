import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listPipelinesWithStages } from "@/lib/actions/pipelines";
import { PipelineSettingsClient } from "@/components/pipeline/settings/pipeline-settings-client";

export default async function PipelineSettingsPage() {
  const pipelines = await listPipelinesWithStages();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" nativeButton={false} render={<Link href="/pipeline" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline settings</h1>
          <p className="text-sm text-muted-foreground">Manage pipelines and their stages.</p>
        </div>
      </div>
      <PipelineSettingsClient pipelines={pipelines} />
    </div>
  );
}
