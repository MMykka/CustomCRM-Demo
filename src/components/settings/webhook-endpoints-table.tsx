"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { createWebhookEndpoint, deleteWebhookEndpoint, listWebhookDeliveries, updateWebhookEndpoint } from "@/lib/actions/webhook-endpoints";
import { WEBHOOK_EVENT_TYPES, type WebhookEventType } from "@/lib/types";
import type { Tables } from "@/lib/supabase/database.types";

type WebhookEndpoint = Tables<"webhook_endpoints">;
type WebhookDelivery = Tables<"webhook_deliveries">;

function EventPicker({ selected, onChange }: { selected: WebhookEventType[]; onChange: (next: WebhookEventType[]) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      {WEBHOOK_EVENT_TYPES.map((event) => (
        <label key={event} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={selected.includes(event)}
            onCheckedChange={(checked) => onChange(checked ? [...selected, event] : selected.filter((e) => e !== event))}
          />
          <span className="font-mono text-xs">{event}</span>
        </label>
      ))}
    </div>
  );
}

function EndpointDialog({ endpoint, trigger }: { endpoint?: WebhookEndpoint; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(endpoint?.url ?? "");
  const [description, setDescription] = useState(endpoint?.description ?? "");
  const [events, setEvents] = useState<WebhookEventType[]>((endpoint?.events as WebhookEventType[]) ?? []);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!url.trim() || events.length === 0) return;
    startTransition(async () => {
      if (endpoint) {
        await updateWebhookEndpoint(endpoint.id, { url, description, events, isActive: endpoint.is_active });
      } else {
        await createWebhookEndpoint({ url, description, events });
      }
      setOpen(false);
      if (!endpoint) {
        setUrl("");
        setDescription("");
        setEvents([]);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{endpoint ? "Edit webhook" : "New webhook endpoint"}</DialogTitle>
          <DialogDescription>Choose which events should be delivered to this URL.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhooks/hub" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Events</Label>
            <EventPicker selected={events} onChange={setEvents} />
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" disabled={isPending || !url.trim() || events.length === 0} onClick={handleSave}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeliveriesDialog({ endpoint }: { endpoint: WebhookEndpoint }) {
  const [open, setOpen] = useState(false);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[] | null>(null);

  async function handleOpen(next: boolean) {
    setOpen(next);
    if (next && deliveries === null) {
      setDeliveries(await listWebhookDeliveries(endpoint.id));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm">Deliveries</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delivery log</DialogTitle>
          <DialogDescription className="font-mono text-xs">{endpoint.url}</DialogDescription>
        </DialogHeader>
        {deliveries === null ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deliveries yet.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {deliveries.map((d) => (
              <li key={d.id} className="flex items-center gap-2 py-2 text-sm">
                <Badge variant={d.status === "success" ? "secondary" : "destructive"}>{d.status}</Badge>
                <span className="font-mono text-xs">{d.event_type}</span>
                <span className="ml-auto text-xs text-muted-foreground">{format(new Date(d.attempted_at), "MMM d, h:mm a")}</span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function WebhookEndpointsTable({ endpoints }: { endpoints: WebhookEndpoint[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <EndpointDialog trigger={<Button size="sm">New endpoint</Button>} />
      </div>
      {endpoints.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">No webhook endpoints yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>URL</TableHead>
              <TableHead>Events</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="w-44" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {endpoints.map((endpoint) => (
              <TableRow key={endpoint.id}>
                <TableCell>
                  <p className="max-w-64 truncate font-mono text-xs">{endpoint.url}</p>
                  {endpoint.description ? <p className="text-xs text-muted-foreground">{endpoint.description}</p> : null}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{endpoint.events.length} event{endpoint.events.length === 1 ? "" : "s"}</TableCell>
                <TableCell>
                  <Switch
                    size="sm"
                    checked={endpoint.is_active}
                    disabled={isPending}
                    onCheckedChange={(checked) =>
                      startTransition(() =>
                        updateWebhookEndpoint(endpoint.id, {
                          url: endpoint.url,
                          description: endpoint.description ?? "",
                          events: endpoint.events as WebhookEventType[],
                          isActive: checked,
                        }),
                      )
                    }
                  />
                </TableCell>
                <TableCell className="flex items-center gap-1">
                  <DeliveriesDialog endpoint={endpoint} />
                  <EndpointDialog
                    endpoint={endpoint}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={isPending}
                    onClick={() => startTransition(() => deleteWebhookEndpoint(endpoint.id))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
