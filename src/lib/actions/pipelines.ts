"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";

type StageUpdate = Database["public"]["Tables"]["stages"]["Update"];

export async function listPipelinesWithStages() {
  await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase.from("pipelines").select("*, stages(*)").order("position");
  if (error) throw error;

  return (data ?? []).map((p) => ({ ...p, stages: (p.stages ?? []).slice().sort((a, b) => a.position - b.position) }));
}

export async function createPipeline(input: { name: string }) {
  if (!input.name.trim()) return null;

  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data: maxPos } = await supabase
    .from("pipelines")
    .select("position")
    .eq("organization_id", appUser.organization_id!)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: pipeline, error } = await supabase
    .from("pipelines")
    .insert({
      organization_id: appUser.organization_id!,
      name: input.name.trim(),
      is_default: false,
      position: (maxPos?.position ?? -1) + 1,
    })
    .select("id")
    .single();

  if (error) throw error;

  // A pipeline is never stage-less -- the kanban board and addDeal both
  // assume at least one stage exists.
  const { error: stageError } = await supabase.from("stages").insert({
    organization_id: appUser.organization_id!,
    pipeline_id: pipeline.id,
    name: "New",
    position: 0,
    probability: 0,
  });
  if (stageError) throw stageError;

  revalidatePath("/pipeline/settings");
  revalidatePath("/pipeline");
  return pipeline.id as string;
}

export async function updatePipeline(pipelineId: string, input: { name: string }) {
  if (!input.name.trim()) return;

  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("pipelines").update({ name: input.name.trim() }).eq("id", pipelineId);
  if (error) throw error;

  revalidatePath("/pipeline/settings");
  revalidatePath("/pipeline");
}

export async function reorderPipelines(orderedIds: string[]) {
  await requireAppUser();
  const supabase = await createClient();

  const results = await Promise.all(orderedIds.map((id, index) => supabase.from("pipelines").update({ position: index }).eq("id", id)));
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;

  revalidatePath("/pipeline/settings");
  revalidatePath("/pipeline");
}

export async function setDefaultPipeline(pipelineId: string) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error: unsetError } = await supabase
    .from("pipelines")
    .update({ is_default: false })
    .eq("organization_id", appUser.organization_id!)
    .eq("is_default", true);
  if (unsetError) throw unsetError;

  const { error: setError } = await supabase.from("pipelines").update({ is_default: true }).eq("id", pipelineId);
  if (setError) throw setError;

  revalidatePath("/pipeline/settings");
  revalidatePath("/pipeline");
}

export async function deletePipeline(pipelineId: string) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { count: pipelineCount } = await supabase
    .from("pipelines")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", appUser.organization_id!);
  if ((pipelineCount ?? 0) <= 1) {
    throw new Error("You can't delete your only pipeline");
  }

  const { count: dealCount } = await supabase.from("deals").select("*", { count: "exact", head: true }).eq("pipeline_id", pipelineId);
  if ((dealCount ?? 0) > 0) {
    throw new Error(`This pipeline still has ${dealCount} deal${dealCount === 1 ? "" : "s"} — move or delete them first`);
  }

  const { data: pipeline } = await supabase.from("pipelines").select("is_default").eq("id", pipelineId).single();

  const { error } = await supabase.from("pipelines").delete().eq("id", pipelineId);
  if (error) throw error;

  if (pipeline?.is_default) {
    const { data: fallback } = await supabase
      .from("pipelines")
      .select("id")
      .eq("organization_id", appUser.organization_id!)
      .order("position")
      .limit(1)
      .maybeSingle();
    if (fallback) {
      await supabase.from("pipelines").update({ is_default: true }).eq("id", fallback.id);
    }
  }

  revalidatePath("/pipeline/settings");
  revalidatePath("/pipeline");
}

export async function createStage(pipelineId: string, input: { name: string; color?: string; probability?: number }) {
  if (!input.name.trim()) return null;

  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data: maxPos } = await supabase
    .from("stages")
    .select("position")
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("stages")
    .insert({
      organization_id: appUser.organization_id!,
      pipeline_id: pipelineId,
      name: input.name.trim(),
      position: (maxPos?.position ?? -1) + 1,
      color: input.color ?? "#64748b",
      probability: input.probability ?? 0,
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/pipeline/settings");
  revalidatePath("/pipeline");
  return data.id as string;
}

export async function updateStage(
  stageId: string,
  input: { name?: string; color?: string; probability?: number; isWon?: boolean; isLost?: boolean },
) {
  await requireAppUser();
  const supabase = await createClient();

  const payload: StageUpdate = {};
  if (input.name !== undefined) payload.name = input.name.trim();
  if (input.color !== undefined) payload.color = input.color;
  if (input.probability !== undefined) payload.probability = input.probability;
  if (input.isWon !== undefined) {
    payload.is_won = input.isWon;
    if (input.isWon) payload.is_lost = false;
  }
  if (input.isLost !== undefined) {
    payload.is_lost = input.isLost;
    if (input.isLost) payload.is_won = false;
  }

  const { error } = await supabase.from("stages").update(payload).eq("id", stageId);
  if (error) throw error;

  revalidatePath("/pipeline/settings");
  revalidatePath("/pipeline");
}

export async function reorderStages(pipelineId: string, orderedIds: string[]) {
  await requireAppUser();
  const supabase = await createClient();

  const results = await Promise.all(
    orderedIds.map((id, index) => supabase.from("stages").update({ position: index }).eq("id", id).eq("pipeline_id", pipelineId)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;

  revalidatePath("/pipeline/settings");
  revalidatePath("/pipeline");
}

export async function deleteStage(stageId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { data: stage } = await supabase.from("stages").select("pipeline_id").eq("id", stageId).single();
  if (!stage) return;

  const { count: dealCount } = await supabase.from("deals").select("*", { count: "exact", head: true }).eq("stage_id", stageId);
  if ((dealCount ?? 0) > 0) {
    throw new Error(`${dealCount} deal${dealCount === 1 ? "" : "s"} ${dealCount === 1 ? "is" : "are"} in this stage — move them first`);
  }

  const { count: stageCount } = await supabase.from("stages").select("*", { count: "exact", head: true }).eq("pipeline_id", stage.pipeline_id);
  if ((stageCount ?? 0) <= 1) {
    throw new Error("A pipeline needs at least one stage");
  }

  const { error } = await supabase.from("stages").delete().eq("id", stageId);
  if (error) throw error;

  revalidatePath("/pipeline/settings");
  revalidatePath("/pipeline");
}
