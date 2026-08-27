"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SortableList } from "@/components/pipeline/settings/sortable-list";
import { addLineItem, deleteLineItem, reorderLineItems, syncDealValueFromLineItems, updateLineItem } from "@/lib/actions/deal-line-items";
import { formatCurrency, type DealLineItem } from "@/lib/types";

export function LineItemsPanel({ dealId, currency, lineItems }: { dealId: string; currency: string; lineItems: DealLineItem[] }) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const router = useRouter();

  const total = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  function handleAdd() {
    if (!name.trim()) return;
    startTransition(async () => {
      await addLineItem(dealId, { name, quantity: Number(quantity) || 1, unitPrice: Number(unitPrice) || 0 });
      setName("");
      setQuantity("1");
      setUnitPrice("0");
    });
  }

  function handleSync() {
    startTransition(async () => {
      await syncDealValueFromLineItems(dealId);
      toast.success("Deal value updated from line items");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {lineItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">No line items yet.</p>
      ) : (
        <SortableList
          items={lineItems}
          onReorder={(orderedIds) => startTransition(() => reorderLineItems(dealId, orderedIds))}
          renderItem={(item) => <LineItemRow key={item.id} item={item} dealId={dealId} currency={currency} />}
        />
      )}

      <div className="flex items-center justify-between border-t pt-2 text-sm">
        <span className="font-medium">Total</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{formatCurrency(total, currency)}</span>
          <Button variant="outline" size="sm" disabled={isPending || lineItems.length === 0} onClick={handleSync}>
            Use this total for deal value
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-lg border p-2">
        <div className="flex min-w-32 flex-1 flex-col gap-1">
          <label className="text-xs text-muted-foreground">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Line item" />
        </div>
        <div className="flex w-20 flex-col gap-1">
          <label className="text-xs text-muted-foreground">Qty</label>
          <Input type="number" min="0" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="flex w-28 flex-col gap-1">
          <label className="text-xs text-muted-foreground">Unit price</label>
          <Input type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </div>
        <Button size="sm" disabled={isPending || !name.trim()} onClick={handleAdd}>
          Add
        </Button>
      </div>
    </div>
  );
}

function LineItemRow({ item, dealId, currency }: { item: DealLineItem; dealId: string; currency: string }) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(item.name);
  const [syncedName, setSyncedName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [syncedQuantity, setSyncedQuantity] = useState(item.quantity);
  const [unitPrice, setUnitPrice] = useState(String(item.unit_price));
  const [syncedUnitPrice, setSyncedUnitPrice] = useState(item.unit_price);

  // SortableList never unmounts a row on reorder, just repositions it, so a
  // plain defaultValue would go stale -- same controlled + render-time-resync
  // idiom as stage-editor.tsx's StageRow.
  if (item.name !== syncedName) {
    setSyncedName(item.name);
    setName(item.name);
  }
  if (item.quantity !== syncedQuantity) {
    setSyncedQuantity(item.quantity);
    setQuantity(String(item.quantity));
  }
  if (item.unit_price !== syncedUnitPrice) {
    setSyncedUnitPrice(item.unit_price);
    setUnitPrice(String(item.unit_price));
  }

  const subtotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const trimmed = name.trim();
          if (trimmed && trimmed !== item.name) startTransition(() => updateLineItem(item.id, dealId, { name: trimmed }));
        }}
        className="min-w-32 flex-1"
      />
      <Input
        type="number"
        min="0"
        step="1"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        onBlur={() => {
          const value = Number(quantity) || 0;
          if (value !== item.quantity) startTransition(() => updateLineItem(item.id, dealId, { quantity: value }));
        }}
        className="w-20"
      />
      <Input
        type="number"
        min="0"
        step="0.01"
        value={unitPrice}
        onChange={(e) => setUnitPrice(e.target.value)}
        onBlur={() => {
          const value = Number(unitPrice) || 0;
          if (value !== item.unit_price) startTransition(() => updateLineItem(item.id, dealId, { unitPrice: value }));
        }}
        className="w-28"
      />
      <span className="w-24 shrink-0 text-right text-sm font-medium">{formatCurrency(subtotal, currency)}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={isPending}
        onClick={() => startTransition(() => deleteLineItem(item.id, dealId))}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
