"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { notifyDealStageChanged, notifyDealLost, notifyDealWon } from "@/lib/n8n";

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

export async function markDealWon(dealId: string, input: { finalValue: number; reason: string; stageId: string }) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data: deal, error: fetchError } = await supabase
    .from("deals")
    .select("stage_id, pipeline_id, organization_id")
    .eq("id", dealId)
    .single();
  if (fetchError) throw fetchError;

  const { error: updateError } = await supabase
    .from("deals")
    .update({
      stage_id: input.stageId,
      status: "won",
      closed_at: new Date().toISOString(),
      won_reason: input.reason,
      value: input.finalValue,
    })
    .eq("id", dealId);
  if (updateError) throw updateError;

  const { error: activityError } = await supabase.from("activities").insert({
    organization_id: appUser.organization_id!,
    deal_id: dealId,
    user_id: appUser.id,
    type: "stage_change",
    metadata: { from_stage_id: deal.stage_id, to_stage_id: input.stageId, outcome: "won" },
  });
  if (activityError) throw activityError;

  void notifyDealWon({
    dealId,
    organizationId: deal.organization_id,
    pipelineId: deal.pipeline_id,
    finalValue: input.finalValue,
    reason: input.reason,
  });

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${dealId}`);
}

export async function markDealLost(dealId: string, input: { reason: string; stageId: string }) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data: deal, error: fetchError } = await supabase
    .from("deals")
    .select("stage_id, pipeline_id, organization_id")
    .eq("id", dealId)
    .single();
  if (fetchError) throw fetchError;

  const { error: updateError } = await supabase
    .from("deals")
    .update({
      stage_id: input.stageId,
      status: "lost",
      closed_at: new Date().toISOString(),
      lost_reason: input.reason,
    })
    .eq("id", dealId);
  if (updateError) throw updateError;

  const { error: activityError } = await supabase.from("activities").insert({
    organization_id: appUser.organization_id!,
    deal_id: dealId,
    user_id: appUser.id,
    type: "stage_change",
    metadata: { from_stage_id: deal.stage_id, to_stage_id: input.stageId, outcome: "lost" },
  });
  if (activityError) throw activityError;

  void notifyDealLost({
    dealId,
    organizationId: deal.organization_id,
    pipelineId: deal.pipeline_id,
    reason: input.reason,
  });

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${dealId}`);
}
