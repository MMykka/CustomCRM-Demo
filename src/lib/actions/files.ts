"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

export type FileEntity = { contactId?: string; dealId?: string };

function pathForEntity(entity: FileEntity) {
  if (entity.dealId) return `/pipeline/${entity.dealId}`;
  if (entity.contactId) return `/contacts/${entity.contactId}`;
  return null;
}

export async function recordFileUpload(
  entity: FileEntity,
  input: { storagePath: string; fileName: string; mimeType: string | null; sizeBytes: number },
) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("files").insert({
    organization_id: appUser.organization_id!,
    contact_id: entity.contactId ?? null,
    deal_id: entity.dealId ?? null,
    uploaded_by: appUser.id,
    storage_path: input.storagePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
  });

  if (error) throw error;

  const path = pathForEntity(entity);
  if (path) revalidatePath(path);
}

export async function deleteFile(fileId: string, entity: FileEntity, storagePath: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error: storageError } = await supabase.storage.from("contact-files").remove([storagePath]);
  if (storageError) throw storageError;

  const { error } = await supabase.from("files").delete().eq("id", fileId);
  if (error) throw error;

  const path = pathForEntity(entity);
  if (path) revalidatePath(path);
}

export async function getSignedFileUrl(storagePath: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase.storage.from("contact-files").createSignedUrl(storagePath, 60);
  if (error) throw error;

  return data.signedUrl;
}
