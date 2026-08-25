"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, LogOut, Plus, UserPlus, Handshake, ListPlus } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { useQuickActions } from "@/components/quick-actions/quick-actions-provider";
import { initialsFor, type Notification } from "@/lib/types";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function AppSidebar({
  userId,
  userName,
  userEmail,
  organizations,
  activeOrgId,
  initialNotifications,
  onNavigate,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  organizations: { id: string; name: string }[];
  activeOrgId: string;
  initialNotifications: Notification[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { openNewContact, openNewDeal, openNewTask, setCommandPaletteOpen } = useQuickActions();

  return (
    <div className="flex h-full w-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-1 border-b p-2">
        <div className="min-w-0 flex-1">
          <OrgSwitcher organizations={organizations} activeOrgId={activeOrgId} />
        </div>
        <NotificationBell userId={userId} initialNotifications={initialNotifications} />
        <ThemeToggle />
      </div>

      <div className="flex flex-col gap-1.5 p-2">
        <Button variant="outline" size="sm" className="justify-start text-muted-foreground" onClick={() => setCommandPaletteOpen(true)}>
          <Search className="size-4" />
          Search...
          <kbd className="ml-auto rounded border bg-muted px-1 font-mono text-[10px]">⌘K</kbd>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="default" size="sm" className="justify-start">
                <Plus className="size-4" />
                New
              </Button>
            }
          />
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={openNewContact}>
              <UserPlus /> Contact
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openNewDeal}>
              <Handshake /> Deal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openNewTask}>
              <ListPlus /> Task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 border-t p-3">
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">{initialsFor(userName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{userName}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">{userEmail}</p>
        </div>
        <form action={signOut}>
          <Button variant="ghost" size="icon" type="submit" title="Sign out">
            <LogOut className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
