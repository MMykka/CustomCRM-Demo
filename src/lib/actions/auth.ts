"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { passwordError } from "@/lib/password";
import { checkLoginThrottle, recordLoginFailure, resetLoginThrottle } from "@/lib/actions/login-throttle";

export async function signIn(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "") || undefined;

  const throttled = await checkLoginThrottle(email);
  if (throttled) {
    return { error: "Too many failed attempts. Try again in a few minutes." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });

  if (error) {
    await recordLoginFailure(email);
    return { error: error.message };
  }

  await resetLoginThrottle(email);

  // Password auth only clears the first factor -- if this account has a
  // verified TOTP factor enrolled, the session is still capped at aal1
  // until the second factor is verified, and requireAppUser() (src/lib/auth.ts)
  // will redirect every protected route to /mfa-challenge until then. Send
  // them there directly instead of bouncing through the app shell first.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
    redirect("/mfa-challenge");
  }

  redirect("/contacts");
}

export async function signUp(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("fullName") ?? "");
  const captchaToken = String(formData.get("cf-turnstile-response") ?? "") || undefined;

  const weakness = passwordError(password);
  if (weakness) {
    return { error: weakness };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName }, captchaToken },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/onboarding");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createOrganization(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const orgName = String(formData.get("orgName") ?? "").trim();

  if (!orgName) {
    return { error: "Organization name is required" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", { org_name: orgName });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/contacts");
}
