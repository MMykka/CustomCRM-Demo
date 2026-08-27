"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useHasMounted } from "@/lib/use-has-mounted";
import { createSavedView, deleteSavedView, type SavedViewEntityType } from "@/lib/actions/saved-views";
import type { SavedView } from "@/lib/types";

const LEGACY_KEY = "hub:contacts:savedViews";
type LegacyView = { id: string; name: string; search: string; tagIds: string[] };

function readLegacyViews(): LegacyView[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function SavedViewsMenu({
  views,
  currentUserId,
  entityType = "contact",
  basePath = "/contacts",
}: {
  views: SavedView[];
  currentUserId: string;
  entityType?: SavedViewEntityType;
  basePath?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [isShared, setIsShared] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasMounted = useHasMounted();
  const [legacyViews, setLegacyViews] = useState<LegacyView[]>([]);
  const [syncedMounted, setSyncedMounted] = useState(false);
  const [legacyDismissed, setLegacyDismissed] = useState(false);

  // Read the legacy localStorage-only views once hydration is safe
  // (render-time state adjustment owned by this component -- see
  // kanban-board.tsx for the same trick; useSyncExternalStore isn't used
  // here since a fresh JSON.parse() returns a new array reference every
  // call, which is exactly the "getSnapshot should be cached" infinite loop).
  if (hasMounted && !syncedMounted) {
    setSyncedMounted(true);
    setLegacyViews(readLegacyViews());
  }

  function applyView(view: SavedView) {
    const filters = (view.filters as Record<string, string>) ?? {};
    const params = new URLSearchParams(filters);
    router.push(`${basePath}${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function saveCurrentView() {
    if (!newViewName.trim()) return;
    const filters = Object.fromEntries(searchParams.entries());
    startTransition(async () => {
      await createSavedView({ name: newViewName, isShared, filters, entityType });
      setNewViewName("");
      setIsShared(false);
      setSaveDialogOpen(false);
      router.refresh();
    });
  }

  function importLegacyViews() {
    startTransition(async () => {
      for (const legacy of legacyViews) {
        await createSavedView({
          name: legacy.name,
          isShared: false,
          filters: { ...(legacy.search ? { q: legacy.search } : {}), ...(legacy.tagIds.length ? { tags: legacy.tagIds.join(",") } : {}) },
        });
      }
      try {
        window.localStorage.removeItem(LEGACY_KEY);
      } catch {
        // ignore unavailable localStorage
      }
      setLegacyDismissed(true);
      router.refresh();
    });
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <Bookmark className="size-4" />
            Views
          </Button>
        }
      />
      <PopoverContent align="start" className="w-72 p-2">
        <div className="flex flex-col gap-1">
          {entityType === "contact" && !legacyDismissed && legacyViews.length > 0 && views.length === 0 ? (
            <div className="mb-1 flex flex-col gap-1.5 rounded-md border bg-muted/40 p-2 text-xs">
              <p>
                Import {legacyViews.length} view{legacyViews.length === 1 ? "" : "s"} saved in this browser?
              </p>
              <div className="flex gap-1.5">
                <Button size="xs" disabled={isPending} onClick={importLegacyViews}>
                  Import
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setLegacyDismissed(true)}>
                  Dismiss
                </Button>
              </div>
            </div>
          ) : null}

          {views.length === 0 ? (
            <p className="p-2 text-sm text-muted-foreground">No saved views yet</p>
          ) : (
            views.map((view) => (
              <div key={view.id} className="flex items-center gap-1">
                <button type="button" onClick={() => applyView(view)} className="flex-1 truncate rounded px-2 py-1.5 text-left text-sm hover:bg-accent">
                  {view.name}
                  {view.is_shared ? <span className="ml-1.5 text-xs text-muted-foreground">shared</span> : null}
                </button>
                {view.created_by === currentUserId ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={isPending}
                    onClick={() => startTransition(async () => { await deleteSavedView(view.id, entityType); router.refresh(); })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            ))
          )}

          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger
              render={
                <Button variant="ghost" size="sm" className="mt-1 justify-start">
                  <Plus className="size-4" />
                  Save current view
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save view</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="view-name">View name</Label>
                  <Input id="view-name" value={newViewName} onChange={(e) => setNewViewName(e.target.value)} placeholder="e.g. Hot leads" autoFocus />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={isShared} onCheckedChange={(checked) => setIsShared(checked === true)} />
                  Share with everyone in the org
                </label>
              </div>
              <DialogFooter>
                <Button onClick={saveCurrentView} disabled={!newViewName.trim() || isPending}>
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </PopoverContent>
    </Popover>
  );
}
