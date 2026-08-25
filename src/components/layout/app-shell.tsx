"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { QuickActionsProvider } from "@/components/quick-actions/quick-actions-provider";
import { CommandPalette } from "@/components/command/command-palette";
import type { Notification } from "@/lib/types";

export function AppShell({
  userId,
  userName,
  userEmail,
  organizations,
  activeOrgId,
  initialNotifications,
  children,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  organizations: { id: string; name: string }[];
  activeOrgId: string;
  initialNotifications: Notification[];
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarProps = { userId, userName, userEmail, organizations, activeOrgId, initialNotifications };

  return (
    <QuickActionsProvider>
      <div className="flex min-h-screen">
        <div className="hidden w-60 shrink-0 border-r md:block">
          <AppSidebar {...sidebarProps} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b p-2 md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Menu className="size-5" />
            </Button>
            <span className="text-sm font-semibold">The Hub</span>
          </div>
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            <AppSidebar {...sidebarProps} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      <CommandPalette />
    </QuickActionsProvider>
  );
}
