# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A multi-tenant CRM ("the Hub"): contacts, companies, deals/pipelines, tasks, messaging, sequences — built on Next.js App Router + Supabase (Postgres/Auth/Storage/Realtime), with n8n as the external automation layer and Claude (via `@anthropic-ai/sdk`) powering in-app AI features (contact summaries, next-action suggestions).

## Commands

- `npm run dev` — start the dev server (see "Running this project locally" below for the full local-stack boot sequence)
- `npm run build` — production build
- `npm run lint` — ESLint (flat config, `eslint-config-next`)
- `npx tsc --noEmit` — type-check only (no separate `typecheck` script)
- `npx supabase@latest start` / `npx supabase stop` — boot/stop local Postgres+Auth+Studio; migrations in `supabase/migrations/` are applied automatically on start
- `npx supabase migration new <name>` — create a new migration file
- `npx supabase gen types typescript --local > src/lib/supabase/database.types.ts` — regenerate DB types after a migration changes the schema

There is no test runner configured in `package.json`. UI verification for this project is done by driving the running app with Playwright ad hoc (see the auto-memory note on Playwright gotchas: use `innerText` not `textContent`, use a wide viewport for kanban drag tests).

## Architecture

**Multi-tenancy**: every domain table carries `organization_id` and is protected by Postgres RLS — the DB, not the app layer, is the tenant boundary. Both `authenticated` and `service_role` need explicit `GRANT`s in a migration; RLS policies alone do not grant access (see `supabase/migrations/*_grants.sql`). When adding a table, add its grants in the same migration.

**Auth/session flow**: `src/middleware.ts` → `src/lib/supabase/middleware.ts` refreshes the Supabase session cookie and redirects unauthenticated requests (except `/login`, `/sign-up`, `/auth`) to `/login`. Server components/actions call `requireAppUser()` (`src/lib/auth.ts`), which additionally loads the `public.users` row and redirects to `/onboarding` if the user has no `organization_id` yet. There are three Supabase client constructors under `src/lib/supabase/`: `client.ts` (browser), `server.ts` (RSC/server actions, cookie-based), and `middleware.ts` (edge middleware) — use the one matching where the code runs.

**Data access pattern**: pages are RSC (`src/app/(app)/**/page.tsx`) that fetch server-side via `createClient()` from `src/lib/supabase/server.ts`, plus per-domain query helpers in `src/lib/*-query.ts` (`contacts-query.ts`, `deals-query.ts`, `tasks-query.ts`) and report aggregation helpers in `src/lib/reports-*.ts`. Mutations go through server actions in `src/lib/actions/*.ts` (one file per domain: `contacts.ts`, `deals.ts`, `pipeline.ts`, `tasks.ts`, etc.), not client-side Supabase calls, so RLS runs with the user's session and side effects (webhooks, audit log) stay server-only.

**Route groups**: `src/app/(app)/` is the authenticated shell (sidebar layout in `src/app/(app)/layout.tsx`) covering dashboard, contacts, companies, pipeline (kanban + list), tasks, calendar, inbox, reports, settings, team-activity. `src/app/login`, `src/app/sign-up`, `src/app/onboarding` sit outside that shell.

**Webhooks to n8n**: `src/lib/n8n.ts` fires fire-and-forget POSTs (5s timeout, swallowed errors) to per-event-type URLs read from env vars (`N8N_DEAL_STAGE_WEBHOOK_URL`, `N8N_DEAL_WON_WEBHOOK_URL`, `N8N_DEAL_LOST_WEBHOOK_URL`, ...). Callers must not `await` these on the critical path of the user-facing mutation. Follow the one-env-var-per-event-type convention when adding new events, and log deliveries to the `webhooks_log` table (see `supabase/migrations/*_webhooks_log.sql`).

**DB-derived types**: `src/lib/supabase/database.types.ts` is generated (do not hand-edit; regenerate via the `supabase gen types` command above). `src/lib/types.ts` hand-maintains string-literal unions (`DealStatus`, `TaskStatus`, `UserRole`, `LifecycleStage`, ...) mirroring Postgres CHECK constraints, because `supabase gen types` only sees real enums, not CHECK constraints — when a migration adds/changes a CHECK-constrained column, update `types.ts` to match by hand.

**Migrations**: sequential timestamped files in `supabase/migrations/`, applied in order by `supabase start`/`db reset`. Recent ones layer on expansions (`contact_expansion_schema`, `deals_expansion_schema`, `tasks_calendar_expansion`) rather than editing earlier files — follow that pattern (new migration, not editing a merged one).

## Frontend stack gotchas

- shadcn/ui components here are on Base UI (`@base-ui/react`), not Radix — use the `render` prop, not `asChild`.
- `@tanstack/react-table` is pinned to v8; don't bump to v9 without checking for breaking API changes across the list views that use it.
- Client components holding `useState(someServerProp)` go stale after `router.refresh()` — the state doesn't re-sync from the new prop value automatically; account for this when a server action needs to update UI that was seeded from a prop.
- Supabase Realtime channel names need a `useId()`-based suffix to avoid collisions when the same component mounts more than once (e.g. two tabs, or nested instances).

## Running this project locally

Everything (Node, Docker, this repo, `.env.local`) is already set up on this machine. When asked to run/launch the project, just do this — no need to re-derive or check status first:

1. `start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"` if Docker isn't already up (check with `docker info`), then poll `docker info` until it responds (usually ~10-30s).
2. From the repo root: `npx supabase@latest start` — boots local Postgres/Auth/Studio and applies migrations. Safe to run even if already running (idempotent).
3. Check if a dev server is already listening on port 3000 (`netstat -ano | grep ":3000" | grep LISTENING`) before starting a new one — `next dev` refuses to double-bind and just idles on 3001 if one's already up, which is wasted work. If none is running: `npm run dev` (run in background).
4. Poll `http://localhost:3000` until it responds, then open it: `start "" "http://localhost:3000"`.

To stop: `npx supabase stop`, and kill whatever PID `netstat` shows listening on port 3000.

Local Supabase Studio: http://127.0.0.1:54323
