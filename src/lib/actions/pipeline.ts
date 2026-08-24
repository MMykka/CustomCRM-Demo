"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { notifyDealStageChanged } from "@/lib/n8n";

export async function moveDealToStage(dealId: string, toStageId: string) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data: deal, error: fetchError } = await supabase
    .from("deals")
    .select("stage_id, pipeline_id, organization_id")
    .eq("id", dealId)
    .single();

  if (fetchError) throw fetchError;
  if (deal.stage_id === toStageId) return;

  const { error: updateError } = await supabase.from("deals").update({ stage_id: toStageId }).eq("id", dealId);
  if (updateError) throw updateError;

  const { error: activityError } = await supabase.from("activities").insert({
    organization_id: appUser.organization_id!,
    deal_id: dealId,
    user_id: appUser.id,
    type: "stage_change",
    metadata: { from_stage_id: deal.stage_id, to_stage_id: toStageId },
  });
  if (activityError) throw activityError;

  void notifyDealStageChanged({
    dealId,
    organizationId: deal.organization_id,
    pipelineId: deal.pipeline_id,
    fromStageId: deal.stage_id,
    toStageId,
  });

  revalidatePath("/pipeline");
}
