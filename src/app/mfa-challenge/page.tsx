"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/lib/actions/auth";

// Reached from requireAppUser() (src/lib/auth.ts) or signIn() when the
// account has a verified TOTP factor and the session hasn't been stepped up
// to aal2 yet. Requires an existing aal1 session (an unauthenticated visitor
// never lands here -- middleware still sends them to /login).
export default function MfaChallengePage() {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "no-factor">("loading");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    createClient()
      .auth.mfa.listFactors()
      .then(({ data, error }) => {
        const verified = data?.totp.find((f) => f.status === "verified");
        if (error || !verified) {
          setStatus("no-factor");
          return;
        }
        setFactorId(verified.id);
        setStatus("ready");
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) {
      setPending(false);
      setError(challengeError?.message ?? "Something went wrong. Try again.");
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.trim() });
    setPending(false);
    if (verifyError) {
      setError("Invalid code. Try again.");
      setCode("");
      return;
    }

    router.push("/contacts");
    router.refresh();
  }

  if (status === "loading") {
    return (
      <AuthLayout title="Verifying">
        <p className="text-sm text-muted-foreground">One moment...</p>
      </AuthLayout>
    );
  }

  if (status === "no-factor") {
    return (
      <AuthLayout title="Something went wrong">
        <p className="text-sm text-muted-foreground">We couldn&apos;t find an active two-factor method on this account. Try signing in again.</p>
        <form action={signOut} className="mt-4">
          <Button type="submit" variant="outline" className="w-full">
            Back to sign in
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Two-factor verification">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="code">Authenticator code</Label>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={6}
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <p className="text-xs text-muted-foreground">Enter the 6-digit code from your authenticator app.</p>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={pending || code.length !== 6} className="w-full">
          {pending ? "Verifying..." : "Verify"}
        </Button>
      </form>
      <form action={signOut} className="mt-4">
        <Button type="submit" variant="ghost" size="sm" className="w-full text-muted-foreground">
          Sign in as someone else
        </Button>
      </form>
    </AuthLayout>
  );
}
