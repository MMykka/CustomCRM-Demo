"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_VALUE = "all";

export function OwnerFilter({
  owners,
  currentOwnerId,
  month,
}: {
  owners: { id: string; full_name: string | null; email: string }[];
  currentOwnerId: string | null;
  month: string;
}) {
  const router = useRouter();

  const items = [{ value: ALL_VALUE, label: "Everyone" }, ...owners.map((o) => ({ value: o.id, label: o.full_name ?? o.email }))];

  function handleChange(value: string | null) {
    const ownerParam = !value || value === ALL_VALUE ? "" : `&owner=${value}`;
    router.push(`/calendar?month=${month}${ownerParam}`);
  }

  return (
    <Select value={currentOwnerId ?? ALL_VALUE} onValueChange={handleChange} items={items}>
      <SelectTrigger size="sm" className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
