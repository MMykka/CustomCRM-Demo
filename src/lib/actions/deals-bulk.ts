"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import { parseDealsFilters, queryDeals } from "@/lib/deals-query";

export async function bulkAssignOwner(dealIds: string[], ownerId: string | null) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("deals").update({ owner_id: ownerId }).in("id", dealIds);
  if (error) throw error;

  revalidatePath("/pipeline");
}

// Deliberately excludes won/lost stages -- bulk-moving deals into a closing
// stage without the reason/revenue prompt would undermine the Won/Lost
// dialog's whole point, so those transitions stay a single-deal action.
export async function bulkChangeStage(dealIds: string[], stageId: string) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data: stage, error: stageError } = await supabase.from("stages").select("is_won, is_lost").eq("id", stageId).single();
  if (stageError) throw stageError;
  if (stage.is_won || stage.is_lost) throw new Error("Use the Won/Lost dialog on individual deals to close them.");

  const { error } = await supabase.from("deals").update({ stage_id: stageId }).in("id", dealIds);
  if (error) throw error;

  const { error: activityError } = await supabase.from("activities").insert(
    dealIds.map((dealId) => ({
      organization_id: appUser.organization_id!,
      deal_id: dealId,
      user_id: appUser.id,
      type: "stage_change",
      metadata: { to_stage_id: stageId, bulk: true },
    })),
  );
  if (activityError) throw activityError;

  revalidatePath("/pipeline");
}

export async function bulkDeleteDeals(dealIds: string[]) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("deals").delete().in("id", dealIds);
  if (error) throw error;

  revalidatePath("/pipeline");
}

const EXPORT_ROW_CAP = 10000;

export async function exportDealsForFilters(searchParams: Record<string, string>) {
  await requireAppUser();
  const supabase = await createClient();

  const filters = parseDealsFilters(searchParams);
  const { rows } = await queryDeals(supabase, { ...filters, page: 1 }, EXPORT_ROW_CAP);
  return rows.map((d) => ({
    id: d.id,
    title: d.title,
    value: d.value,
    currency: d.currency,
    status: d.status,
    stage: d.stage?.name ?? "",
    pipeline: d.pipeline?.name ?? "",
    contact: d.contact ? [d.contact.first_name, d.contact.last_name].filter(Boolean).join(" ") || d.contact.email : "",
    company: d.company?.name ?? "",
    owner: d.owner?.full_name ?? d.owner?.email ?? "",
    expected_close_date: d.expected_close_date,
    created_at: d.created_at,
  }));
}
