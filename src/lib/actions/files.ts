"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

export async function recordFileUpload(
  contactId: string,
  input: { storagePath: string; fileName: string; mimeType: string | null; sizeBytes: number },
) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase.from("files").insert({
    organization_id: appUser.organization_id!,
    contact_id: contactId,
    uploaded_by: appUser.id,
    storage_path: input.storagePath,
    file_name: input.fileName,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
  });

  if (error) throw error;

  revalidatePath(`/contacts/${contactId}`);
}

export async function deleteFile(fileId: string, contactId: string, storagePath: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error: storageError } = await supabase.storage.from("contact-files").remove([storagePath]);
  if (storageError) throw storageError;

  const { error } = await supabase.from("files").delete().eq("id", fileId);
  if (error) throw error;

  revalidatePath(`/contacts/${contactId}`);
}

export async function getSignedFileUrl(storagePath: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase.storage.from("contact-files").createSignedUrl(storagePath, 60);
  if (error) throw error;

  return data.signedUrl;
}
