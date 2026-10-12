# Custom CRM - the Hub

A multi-tenant CRM (Next.js + Supabase) — contacts, companies, deals/pipelines,
tasks, activities, and org-scoped tags/custom fields, with an outbound n8n
integration for deal-stage/won/lost notifications.

## Public API (v1)

A general-purpose, API-key-authenticated REST API for contacts, so any
website, form builder, automation tool (Zapier, Make, n8n) or custom app can
create, update, find and tag contacts in the Hub.

**Base URL:** `https://custom-crm-hub.vercel.app/api/v1` — full reference:
**[docs/API.md](docs/API.md)**.

```bash
curl -X POST https://custom-crm-hub.vercel.app/api/v1/contacts/upsert \
  -H "Authorization: Bearer hub_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Ada Lovelace", "email": "ada@example.com", "tags": ["Newsletter"]}'
```

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/contacts/upsert` | Create or update one contact (matched by id → external_id → email → phone), or up to 100 in a batch |
| GET | `/contacts` | List, search and filter contacts (cursor pagination, `updated_since` for syncs) |
| POST | `/contacts` | Create a contact; 409 if the email or external_id exists |
| GET · PATCH · PUT · DELETE | `/contacts/{id}` | Read, update the fields sent, or delete one contact |
| POST · DELETE | `/contacts/{id}/tags` | Add or remove tags |
| GET · POST | `/contacts/{id}/activities` | Read or add timeline entries |
| GET | `/contacts/fields`, `/tags`, `/me` | Field/tag discovery and a connection test |

- **Auth**: an API key from **Settings → API Keys**, sent as
  `Authorization: Bearer ...`, `X-API-Key: ...` or `?api_key=...`.
- **Any client**: accepts JSON, urlencoded and multipart bodies with
  flexible field names (`firstName`, `first_name`, `First Name`, `fname`
  all work), so a plain HTML `<form>` can post straight to it (with a
  post-submit redirect and a honeypot spam trap).
- **Limits**: 600 requests/minute per key (`X-RateLimit-*` headers, `429`
  over the limit); batch upsert takes 100 contacts per request.
- **Webhooks**: endpoints configured in Settings receive HMAC-signed
  `contact.created` / `contact.updated` / `contact.deleted` events.
- **Code**: routes in [`src/app/api/v1/`](src/app/api/v1/), shared logic in
  [`src/lib/api/v1/`](src/lib/api/v1/) (auth, rate limiting and parsing in
  `http.ts`; contact reads/writes in `contacts.ts`), webhook delivery in
  [`src/lib/webhooks.ts`](src/lib/webhooks.ts). Keys are checked and
  rate-limited in one `api_authenticate()` database call
  ([migration](supabase/migrations/20261012000001_public_api_v1.sql)).

## External lead sync

`POST /api/public/leads` is a small authenticated public API endpoint that
lets an external app push a lead in as a contact and keep it tagged as that
lead moves through a nurture flow. It's currently used by the sibling
**AI-Powered Lead Nurture Workflow** project (`../AI-Powered Lead Nurture
Workflow`), which forwards every real (non-simulated) lead here — see that
project's README and [`src/lib/hubService.ts`](../AI-Powered%20Lead%20Nurture%20Workflow/src/lib/hubService.ts)
for the calling side.

- **Auth**: `Authorization: Bearer hub_live_...`, an API key created from
  **Settings → API Keys** in the Hub UI (`src/lib/actions/api-keys.ts`).
  The route hashes the incoming key and compares it against the stored
  `key_hash` (see [`src/lib/publicApi.ts`](src/lib/publicApi.ts)) — never a
  Supabase session, so it's excluded from the session-cookie redirect in
  [`src/lib/supabase/middleware.ts`](src/lib/supabase/middleware.ts).
- **What it does**: find-or-creates a `contacts` row by email, tags it
  (`Nurture: Day 0/2/5 Sent`, `Nurture: Booked/Converted`,
  `Nurture: Escalated`), logs an `activities` entry so the tag change shows
  up on the contact's timeline, and — on a `converted` event — moves
  `lifecycle_stage` to `customer`. See
  [`src/app/api/public/leads/route.ts`](src/app/api/public/leads/route.ts).
- All writes use the service-role client (`createAdminClient()`), since an
  external caller has no Supabase session for RLS to key off of.

This is a boilerplate project otherwise — see below for the standard
Next.js `create-next-app` getting-started info.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
