"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import type { CustomFieldEntityType, CustomFieldType } from "@/lib/types";

export async function listCustomFields() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("custom_fields")
    .select("*")
    .eq("organization_id", appUser.organization_id!)
    .order("entity_type")
    .order("position");

  if (error) throw error;
  return data ?? [];
}

export async function createCustomField(input: {
  entityType: CustomFieldEntityType;
  name: string;
  fieldKey: string;
  fieldType: CustomFieldType;
  options: string[] | null;
}) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { count } = await supabase
    .from("custom_fields")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", appUser.organization_id!)
    .eq("entity_type", input.entityType);

  const { error } = await supabase.from("custom_fields").insert({
    organization_id: appUser.organization_id!,
    entity_type: input.entityType,
    name: input.name,
    field_key: input.fieldKey,
    field_type: input.fieldType,
    options: input.options,
    position: count ?? 0,
  });

  if (error) throw error;
  revalidatePath("/settings/custom-fields");
}

export async function updateCustomField(
  fieldId: string,
  input: { name: string; options: string[] | null },
) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("custom_fields").update({ name: input.name, options: input.options }).eq("id", fieldId);
  if (error) throw error;

  revalidatePath("/settings/custom-fields");
}

export async function deleteCustomField(fieldId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("custom_fields").delete().eq("id", fieldId);
  if (error) throw error;

  revalidatePath("/settings/custom-fields");
}
