"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Handshake, ListPlus } from "lucide-react";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useQuickActions } from "@/components/quick-actions/quick-actions-provider";
import { globalSearch, type SearchResults } from "@/lib/actions/search";
import { NAV_ITEMS } from "@/lib/nav";

const EMPTY_RESULTS: SearchResults = { contacts: [], companies: [], deals: [], messages: [] };

export function CommandPalette() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const router = useRouter();
  const { openNewContact, openNewDeal, openNewTask, commandPaletteOpen: open, setCommandPaletteOpen: setOpen } = useQuickActions();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(!open);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, setOpen]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timeout = setTimeout(() => {
      globalSearch(query).then(setResults);
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  function close() {
    setOpen(false);
    setQuery("");
    setResults(EMPTY_RESULTS);
  }

  function go(href: string) {
    close();
    router.push(href);
  }

  function runAction(action: () => void) {
    close();
    action();
  }

  const filteredNav = NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()));
  const displayResults = query.trim().length < 2 ? EMPTY_RESULTS : results;

  return (
    <CommandDialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <Command shouldFilter={false}>
        <CommandInput value={query} onValueChange={setQuery} placeholder="Search or jump to..." />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>

          {query.trim().length < 2 ? (
            <CommandGroup heading="Quick actions">
              <CommandItem onSelect={() => runAction(openNewContact)}>
                <UserPlus /> New contact
              </CommandItem>
              <CommandItem onSelect={() => runAction(openNewDeal)}>
                <Handshake /> New deal
              </CommandItem>
              <CommandItem onSelect={() => runAction(openNewTask)}>
                <ListPlus /> New task
              </CommandItem>
            </CommandGroup>
          ) : null}

          {filteredNav.length > 0 ? (
            <CommandGroup heading="Jump to">
              {filteredNav.map((item) => (
                <CommandItem key={item.href} onSelect={() => go(item.href)}>
                  <item.icon /> {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {displayResults.contacts.length > 0 ? (
            <CommandGroup heading="Contacts">
              {displayResults.contacts.map((c) => (
                <CommandItem key={c.id} onSelect={() => go(`/contacts/${c.id}`)}>
                  {c.label}
                  {c.sublabel ? <span className="ml-auto text-xs text-muted-foreground">{c.sublabel}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {displayResults.companies.length > 0 ? (
            <CommandGroup heading="Companies">
              {displayResults.companies.map((c) => (
                <CommandItem key={c.id} onSelect={() => go(`/companies/${c.id}`)}>
                  {c.label}
                  {c.sublabel ? <span className="ml-auto text-xs text-muted-foreground">{c.sublabel}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {displayResults.deals.length > 0 ? (
            <CommandGroup heading="Deals">
              {displayResults.deals.map((d) => (
                <CommandItem key={d.id} onSelect={() => go("/pipeline")}>
                  {d.label}
                  {d.sublabel ? <span className="ml-auto text-xs text-muted-foreground">{d.sublabel}</span> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}

          {displayResults.messages.length > 0 ? (
            <CommandGroup heading="Messages">
              {displayResults.messages.map((m) => (
                <CommandItem key={m.id} onSelect={() => go(m.contactId ? `/contacts/${m.contactId}` : "/inbox")}>
                  {m.label}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
