import type { ReactNode } from "react";
import { LogoMark } from "./logo-mark";

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <LogoMark className="mb-8 size-8 text-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <div className="mt-8">{children}</div>
        </div>
      </div>

      <div className="relative hidden flex-col justify-between overflow-hidden bg-neutral-950 p-10 lg:flex">
        <div>
          <h2 className="max-w-sm text-3xl leading-tight font-semibold text-white">
            One place for contacts, deals, and the next thing to do about them.
          </h2>
          <p className="mt-3 max-w-xs text-sm text-neutral-400">
            Includes an AI assistant on every contact to summarize the relationship and suggest what to do next.
          </p>
        </div>

        <div className="grid grid-cols-3 grid-rows-2 gap-4">
          <div className="col-span-2 row-span-1 rounded-2xl bg-brand-blue p-4">
            <div className="h-2 w-10 rounded-full bg-brand-blue-foreground/40" />
            <div className="mt-2 h-2 w-16 rounded-full bg-brand-blue-foreground/25" />
          </div>
          <div className="row-span-2 flex items-end rounded-2xl bg-brand-pink p-4">
            <div className="size-8 rounded-full bg-brand-pink-foreground/40" />
          </div>
          <div className="rounded-2xl bg-brand-yellow p-4">
            <div className="h-2 w-8 rounded-full bg-brand-yellow-foreground/40" />
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="h-2 w-10 rounded-full bg-white/20" />
            <div className="mt-2 h-2 w-6 rounded-full bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
