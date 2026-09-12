"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

type EnrollState = { factorId: string; qrCode: string; secret: string } | null;

export function TwoFactorSettings() {
  const [status, setStatus] = useState<"loading" | "off" | "on">("loading");
  const [enrolling, setEnrolling] = useState<EnrollState>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [verifiedFactorId, setVerifiedFactorId] = useState<string | null>(null);

  async function refresh() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setStatus("off");
      return;
    }
    const verified = data.totp.find((f) => f.status === "verified");
    if (verified) {
      setVerifiedFactorId(verified.id);
      setStatus("on");
    } else {
      setVerifiedFactorId(null);
      setStatus("off");
    }
  }

  useEffect(() => {
    createClient()
      .auth.mfa.listFactors()
      .then(({ data, error }) => {
        const verified = data?.totp.find((f) => f.status === "verified");
        if (error || !verified) {
          setVerifiedFactorId(null);
          setStatus("off");
          return;
        }
        setVerifiedFactorId(verified.id);
        setStatus("on");
      });
  }, []);

  async function startEnroll() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) {
      toast.error(error?.message ?? "Couldn't start enrollment. Try again.");
      return;
    }
    setEnrolling({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }

  async function cancelEnroll() {
    if (enrolling) {
      const supabase = createClient();
      await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
    }
    setEnrolling(null);
    setCode("");
  }

  async function verifyEnroll() {
    if (!enrolling) return;
    setPending(true);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
    if (challengeError || !challenge) {
      setPending(false);
      toast.error(challengeError?.message ?? "Couldn't verify code. Try again.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrolling.factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setPending(false);
    if (verifyError) {
      toast.error("Invalid code. Try again.");
      setCode("");
      return;
    }
    toast.success("Two-factor authentication enabled");
    setEnrolling(null);
    setCode("");
    refresh();
  }

  async function removeTwoFactor() {
    if (!verifiedFactorId) return;
    setRemoving(true);
    const supabase = createClient();
    const { error } = await supabase.auth.mfa.unenroll({ factorId: verifiedFactorId });
    setRemoving(false);
    if (error) {
      toast.error("Couldn't remove two-factor authentication. Try again.");
      return;
    }
    toast.success("Two-factor authentication removed");
    refresh();
  }

  if (status === "loading") {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  if (status === "on") {
    return (
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4 text-brand-blue-foreground" />
          <span>Two-factor authentication is turned on.</span>
        </div>
        <Button variant="outline" size="sm" disabled={removing} onClick={removeTwoFactor}>
          <ShieldOff className="size-3.5" />
          {removing ? "Removing..." : "Turn off"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">Require an authenticator app code in addition to your password when signing in.</p>
      <Button size="sm" onClick={startEnroll}>
        Enable 2FA
      </Button>

      <Dialog open={Boolean(enrolling)} onOpenChange={(open) => !open && cancelEnroll()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>Scan this QR code with an authenticator app (like Google Authenticator or 1Password), then enter the code it shows.</DialogDescription>
          </DialogHeader>
          {enrolling ? (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- next/image can't optimize a dynamic data: URI */}
              <img
                src={`data:image/svg+xml;utf-8,${encodeURIComponent(enrolling.qrCode)}`}
                alt="Scan with your authenticator app"
                className="size-40 rounded-md border bg-white p-2"
              />
              <p className="break-all text-center text-xs text-muted-foreground">Or enter manually: {enrolling.secret}</p>
              <div className="flex w-full flex-col gap-1.5">
                <Label htmlFor="totp-code">6-digit code</Label>
                <Input
                  id="totp-code"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={cancelEnroll} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={verifyEnroll} disabled={pending || code.length !== 6}>
              {pending ? "Verifying..." : "Verify & enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
