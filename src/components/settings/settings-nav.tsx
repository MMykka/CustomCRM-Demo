"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SETTINGS_NAV_ITEMS = [
  { href: "/settings", label: "Organization" },
  { href: "/settings/members", label: "Team members" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/custom-fields", label: "Custom fields" },
  { href: "/settings/tags", label: "Tags" },
  { href: "/settings/templates", label: "Message templates" },
  { href: "/settings/sequences", label: "Sequences" },
  { href: "/settings/integrations", label: "Integrations" },
  { href: "/settings/api-keys", label: "API & webhooks" },
  { href: "/settings/audit-log", label: "Audit log" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b pb-3">
      {SETTINGS_NAV_ITEMS.map((item) => {
        const isActive = item.href === "/settings" ? pathname === "/settings" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
