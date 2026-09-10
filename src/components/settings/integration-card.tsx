"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { connectIntegration, disconnectIntegration } from "@/lib/actions/integrations";
import { INTEGRATION_PROVIDERS, type IntegrationProvider } from "@/lib/integrations";

type IntegrationRow = { provider: string; status: string; config: Record<string, string> };

export function IntegrationCard({ provider, row, canManage }: { provider: (typeof INTEGRATION_PROVIDERS)[number]; row: IntegrationRow | undefined; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(provider.fields.map((f) => [f.key, ""])));
  const [isPending, startTransition] = useTransition();

  const isConnected = row?.status === "connected";

  function handleConnect() {
    startTransition(async () => {
      await connectIntegration(provider.provider as IntegrationProvider, values);
      setOpen(false);
    });
  }

  function handleDisconnect() {
    startTransition(() => disconnectIntegration(provider.provider as IntegrationProvider));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{provider.label}</CardTitle>
        <CardAction>
          <Badge variant={isConnected ? "default" : "outline"}>{isConnected ? "Connected" : "Not connected"}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isConnected && row ? (
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {provider.fields.map((field) => (
              <li key={field.key}>
                {field.label}: {row.config[field.key] ?? "—"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Not connected.</p>
        )}

        {canManage ? (
          isConnected ? (
            <Button variant="outline" size="sm" className="w-fit" disabled={isPending} onClick={handleDisconnect}>
              Disconnect
            </Button>
          ) : (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button size="sm" className="w-fit">Connect</Button>} />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Connect {provider.label}</DialogTitle>
                  <DialogDescription>These values are stored for this organization only.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                  {provider.fields.map((field) => (
                    <div key={field.key} className="flex flex-col gap-1.5">
                      <Label>{field.label}</Label>
                      <Input
                        type="password"
                        value={values[field.key] ?? ""}
                        onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button
                    size="sm"
                    disabled={isPending || provider.fields.some((f) => !values[f.key]?.trim())}
                    onClick={handleConnect}
                  >
                    {isPending ? "Connecting..." : "Connect"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
