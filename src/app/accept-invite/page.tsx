"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

// Lands here from the invite email's link, which carries a session token
// in the URL hash (never sent to the server, so middleware can't see it --
// this route is in PUBLIC_PATHS). The browser client is configured for PKCE
// (the @supabase/ssr default), which only auto-detects a `?code=` query
// param, not GoTrue's implicit-flow `#access_token=` hash that invite/magic
// links use -- so the hash is parsed and exchanged for a session by hand.
// Then the user sets a password, since inviteUserByEmail creates the
// account without one.
export default function AcceptInvitePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "invalid">("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    const establishSession = accessToken && refreshToken
      ? createClient().auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      : Promise.resolve({ error: new Error("missing session tokens") });

    establishSession.then(({ error }) => {
      setStatus(error ? "invalid" : "ready");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/contacts");
    router.refresh();
  }

  if (status === "loading") {
    return (
      <AuthLayout title="Setting up your account">
        <p className="text-sm text-muted-foreground">One moment...</p>
      </AuthLayout>
    );
  }

  if (status === "invalid") {
    return (
      <AuthLayout title="This invite link has expired">
        <p className="text-sm text-muted-foreground">Ask whoever invited you to send a new one, or sign in if you already have a password.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set your password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Saving..." : "Continue"}
        </Button>
      </form>
    </AuthLayout>
  );
}
