"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { NewContactDialog } from "@/components/contacts/new-contact-dialog";
import { NewDealDialog } from "@/components/pipeline/new-deal-dialog";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";

type QuickActionsValue = {
  openNewContact: () => void;
  openNewDeal: () => void;
  openNewTask: () => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
};

const QuickActionsContext = createContext<QuickActionsValue | null>(null);

export function useQuickActions() {
  const ctx = useContext(QuickActionsContext);
  if (!ctx) throw new Error("useQuickActions must be used within QuickActionsProvider");
  return ctx;
}

type DialogKind = "contact" | "deal" | "task" | null;

export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const value: QuickActionsValue = {
    openNewContact: () => setDialog("contact"),
    openNewDeal: () => setDialog("deal"),
    openNewTask: () => setDialog("task"),
    commandPaletteOpen,
    setCommandPaletteOpen,
  };

  return (
    <QuickActionsContext.Provider value={value}>
      {children}
      <NewContactDialog open={dialog === "contact"} onOpenChange={(open) => setDialog(open ? "contact" : null)} />
      <NewDealDialog open={dialog === "deal"} onOpenChange={(open) => setDialog(open ? "deal" : null)} />
      <NewTaskDialog open={dialog === "task"} onOpenChange={(open) => setDialog(open ? "task" : null)} />
    </QuickActionsContext.Provider>
  );
}
