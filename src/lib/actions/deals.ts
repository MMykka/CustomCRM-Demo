"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

export async function addDeal(input: { title: string; value: number; contactId: string | null }) {
  if (!input.title.trim()) return null;

  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data: pipeline, error: pipelineError } = await supabase
    .from("pipelines")
    .select("id")
    .eq("organization_id", appUser.organization_id!)
    .order("is_default", { ascending: false })
    .order("position")
    .limit(1)
    .single();
  if (pipelineError) throw pipelineError;

  const { data: stage, error: stageError } = await supabase
    .from("stages")
    .select("id")
    .eq("pipeline_id", pipeline.id)
    .order("position")
    .limit(1)
    .single();
  if (stageError) throw stageError;

  const { data, error } = await supabase
    .from("deals")
    .insert({
      organization_id: appUser.organization_id!,
      pipeline_id: pipeline.id,
      stage_id: stage.id,
      title: input.title.trim(),
      value: input.value || 0,
      contact_id: input.contactId,
      owner_id: appUser.id,
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/pipeline");
  return data.id as string;
}
