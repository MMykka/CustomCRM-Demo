"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";

type DealUpdate = Database["public"]["Tables"]["deals"]["Update"];

export async function addDeal(input: { title: string; value: number; contactId: string | null; pipelineId?: string | null }) {
  if (!input.title.trim()) return null;

  const appUser = await requireAppUser();
  const supabase = await createClient();

  let pipelineId = input.pipelineId;
  if (!pipelineId) {
    const { data: pipeline, error: pipelineError } = await supabase
      .from("pipelines")
      .select("id")
      .eq("organization_id", appUser.organization_id!)
      .order("is_default", { ascending: false })
      .order("position")
      .limit(1)
      .single();
    if (pipelineError) throw pipelineError;
    pipelineId = pipeline.id;
  }

  const { data: stage, error: stageError } = await supabase
    .from("stages")
    .select("id")
    .eq("pipeline_id", pipelineId)
    .order("position")
    .limit(1)
    .single();
  if (stageError) throw stageError;

  const { data, error } = await supabase
    .from("deals")
    .insert({
      organization_id: appUser.organization_id!,
      pipeline_id: pipelineId,
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

export async function updateDeal(
  dealId: string,
  input: {
    title: string;
    value: number;
    contactId: string | null;
    companyId: string | null;
    ownerId: string | null;
    expectedCloseDate: string | null;
  },
) {
  if (!input.title.trim()) return;

  await requireAppUser();
  const supabase = await createClient();

  const payload: DealUpdate = {
    title: input.title.trim(),
    value: input.value || 0,
    contact_id: input.contactId,
    company_id: input.companyId,
    owner_id: input.ownerId,
    expected_close_date: input.expectedCloseDate,
  };

  const { error } = await supabase.from("deals").update(payload).eq("id", dealId);
  if (error) throw error;

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${dealId}`);
}
