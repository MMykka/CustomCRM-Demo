"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

export async function markNotificationRead(notificationId: string) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null);

  if (error) throw error;

  revalidatePath("/", "layout");
}

export async function markAllNotificationsRead() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", appUser.id)
    .is("read_at", null);

  if (error) throw error;

  revalidatePath("/", "layout");
}
