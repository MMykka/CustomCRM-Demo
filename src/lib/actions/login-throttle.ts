"use server";

import { createClient } from "@/lib/supabase/server";

const MAX_FAILURES = 5;

// Backed by supabase/migrations/20260912143122_login_throttle_and_totp.sql --
// these RPCs are callable pre-auth (as `anon`) since login itself is what's
// being throttled. See that migration for the failure window/threshold.

export async function checkLoginThrottle(email: string): Promise<boolean> {
  if (!email) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("count_recent_login_failures", { p_email: email });
  if (error) return false;
  return (data ?? 0) >= MAX_FAILURES;
}

export async function recordLoginFailure(email: string): Promise<void> {
  if (!email) return;
  const supabase = await createClient();
  await supabase.rpc("record_login_failure", { p_email: email });
}

export async function resetLoginThrottle(email: string): Promise<void> {
  if (!email) return;
  const supabase = await createClient();
  await supabase.rpc("reset_login_failures", { p_email: email });
}
