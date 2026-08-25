"use client";

import { useEffect, useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import type { Notification } from "@/lib/types";

export function NotificationBell({ userId, initialNotifications }: { userId: string; initialNotifications: Notification[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [syncedInitial, setSyncedInitial] = useState(initialNotifications);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const instanceId = useId();

  // Re-seed local state when the server hands us a fresh notifications prop
  // (e.g. after a revalidate), without a setState-in-effect: this is React's
  // documented "adjust state during render" pattern, not a side effect.
  if (initialNotifications !== syncedInitial) {
    setSyncedInitial(initialNotifications);
    setNotifications(initialNotifications);
  }

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((current) => [payload.new as Notification, ...current]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, instanceId]);

  const unread = notifications.filter((n) => !n.read_at);

  function handleSelect(notification: Notification) {
    startTransition(async () => {
      await markNotificationRead(notification.id);
      setNotifications((current) => current.map((n) => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)));
      if (notification.link_url) router.push(notification.link_url);
    });
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" title="Notifications">
            <Bell className="size-4" />
            {unread.length > 0 ? (
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                {unread.length > 9 ? "9+" : unread.length}
              </span>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-2.5">
          <p className="text-sm font-medium">Notifications</p>
          {unread.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await markAllNotificationsRead();
                  setNotifications((current) => current.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
                })
              }
            >
              Mark all read
            </Button>
          ) : null}
        </div>
        <div className="flex max-h-80 flex-col overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleSelect(notification)}
                className={`flex flex-col gap-0.5 border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent ${
                  notification.read_at ? "" : "bg-accent/40"
                }`}
              >
                <p className="font-medium">{notification.title}</p>
                {notification.body ? <p className="truncate text-xs text-muted-foreground">{notification.body}</p> : null}
                <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}</p>
              </button>
            ))
          )}
        </div>
        <div className="border-t p-2 text-center">
          <Link href="/tasks" className="text-xs text-muted-foreground hover:underline">
            View all tasks
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
