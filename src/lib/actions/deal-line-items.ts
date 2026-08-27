"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";

type LineItemUpdate = Database["public"]["Tables"]["deal_line_items"]["Update"];

export async function addLineItem(dealId: string, input: { name: string; quantity: number; unitPrice: number }) {
  if (!input.name.trim()) return;

  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data: existing } = await supabase.from("deal_line_items").select("position").eq("deal_id", dealId).order("position", { ascending: false }).limit(1);
  const nextPosition = existing && existing.length > 0 ? existing[0]!.position + 1 : 0;

  const { error } = await supabase.from("deal_line_items").insert({
    organization_id: appUser.organization_id!,
    deal_id: dealId,
    name: input.name.trim(),
    quantity: input.quantity || 1,
    unit_price: input.unitPrice || 0,
    position: nextPosition,
  });

  if (error) throw error;

  revalidatePath(`/pipeline/${dealId}`);
}

export async function updateLineItem(lineItemId: string, dealId: string, input: { name?: string; quantity?: number; unitPrice?: number }) {
  await requireAppUser();
  const supabase = await createClient();

  const payload: LineItemUpdate = {};
  if (input.name !== undefined) payload.name = input.name.trim();
  if (input.quantity !== undefined) payload.quantity = input.quantity;
  if (input.unitPrice !== undefined) payload.unit_price = input.unitPrice;

  const { error } = await supabase.from("deal_line_items").update(payload).eq("id", lineItemId);
  if (error) throw error;

  revalidatePath(`/pipeline/${dealId}`);
}

export async function deleteLineItem(lineItemId: string, dealId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("deal_line_items").delete().eq("id", lineItemId);
  if (error) throw error;

  revalidatePath(`/pipeline/${dealId}`);
}

export async function reorderLineItems(dealId: string, orderedIds: string[]) {
  await requireAppUser();
  const supabase = await createClient();

  const results = await Promise.all(
    orderedIds.map((id, index) => supabase.from("deal_line_items").update({ position: index }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;

  revalidatePath(`/pipeline/${dealId}`);
}

export async function syncDealValueFromLineItems(dealId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { data: lineItems, error: fetchError } = await supabase.from("deal_line_items").select("quantity, unit_price").eq("deal_id", dealId);
  if (fetchError) throw fetchError;

  const total = (lineItems ?? []).reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const { error } = await supabase.from("deals").update({ value: total }).eq("id", dealId);
  if (error) throw error;

  revalidatePath("/pipeline");
  revalidatePath(`/pipeline/${dealId}`);
}
