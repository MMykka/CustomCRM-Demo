"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createApiKey, revokeApiKey } from "@/lib/actions/api-keys";
import type { Tables } from "@/lib/supabase/database.types";

type ApiKey = Tables<"api_keys">;

function CreateKeyDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [plaintextKey, setPlaintextKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!name.trim()) return;
    startTransition(async () => {
      const { plaintextKey } = await createApiKey(name.trim());
      setPlaintextKey(plaintextKey);
    });
  }

  function handleClose(next: boolean) {
    setOpen(next);
    if (!next) {
      setName("");
      setPlaintextKey(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger render={<Button size="sm">Create key</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{plaintextKey ? "Key created" : "New API key"}</DialogTitle>
          <DialogDescription>
            {plaintextKey ? "Copy this key now -- you won't be able to see it again." : "Name it after what will use it."}
          </DialogDescription>
        </DialogHeader>
        {plaintextKey ? (
          <div className="flex items-center gap-2">
            <Input readOnly value={plaintextKey} className="font-mono text-xs" />
            <Button variant="outline" size="icon-sm" onClick={() => navigator.clipboard.writeText(plaintextKey)}>
              <Copy className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
        )}
        <DialogFooter>
          {plaintextKey ? (
            <Button size="sm" onClick={() => handleClose(false)}>
              Done
            </Button>
          ) : (
            <Button size="sm" disabled={isPending || !name.trim()} onClick={handleCreate}>
              {isPending ? "Creating..." : "Create"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApiKeysTable({ apiKeys }: { apiKeys: ApiKey[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <CreateKeyDialog />
      </div>
      {apiKeys.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">No API keys yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.map((key) => (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{key.key_prefix}…</TableCell>
                <TableCell className="text-muted-foreground">{format(new Date(key.created_at), "MMM d, yyyy")}</TableCell>
                <TableCell className="text-muted-foreground">{key.last_used_at ? format(new Date(key.last_used_at), "MMM d, yyyy") : "Never"}</TableCell>
                <TableCell>
                  {key.revoked_at ? <Badge variant="destructive">Revoked</Badge> : <Badge variant="secondary">Active</Badge>}
                </TableCell>
                <TableCell>
                  {!key.revoked_at ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => startTransition(() => revokeApiKey(key.id))}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
