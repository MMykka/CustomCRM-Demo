# The Hub CRM — Contacts API v1

The Contacts API lets any website, form builder, automation tool or custom app create, update, find and tag contacts in The Hub using an API key. It is a JSON REST API with stable, versioned URLs.

**Base URL:** `https://custom-crm-hub.vercel.app/api/v1`

Most integrations need only one call: **`POST /contacts/upsert`**. It creates the contact if it is new and updates it if it already exists, so it is safe to call every time someone fills in a form.

- [Quick start](#quick-start)
- [Authentication](#authentication)
- [Requests and responses](#requests-and-responses)
- [The contact object](#the-contact-object)
- [Endpoints](#endpoints)
- [Website forms](#website-forms)
- [Webhooks](#webhooks)
- [Recipes](#recipes)

## Quick start

```bash
curl -X POST https://custom-crm-hub.vercel.app/api/v1/contacts/upsert \
  -H "Authorization: Bearer hub_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "phone": "+1 555 010 0001",
    "company": "Analytical Engines Ltd",
    "source": "website",
    "tags": ["Newsletter"],
    "note": "Signed up from the pricing page"
  }'
```

The response contains the full contact and whether it was created (`201`) or updated (`200`).

### Endpoints at a glance

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/contacts/upsert` | Create or update one contact, or up to 100 in a batch |
| GET | `/contacts` | List, search and filter contacts (cursor pagination) |
| POST | `/contacts` | Create a contact; fails with 409 if the email or external_id exists |
| GET | `/contacts/{id}` | Get one contact |
| PATCH / PUT | `/contacts/{id}` | Update the fields you send |
| DELETE | `/contacts/{id}` | Permanently delete a contact |
| POST / DELETE | `/contacts/{id}/tags` | Add or remove tags |
| GET / POST | `/contacts/{id}/activities` | Read or add timeline entries |
| GET | `/contacts/fields` | List standard and custom fields |
| GET | `/tags` | List the organization's tags |
| GET | `/me` | Check that a key works |

## Authentication

Every request needs an API key. An owner or admin creates one in **Settings → API Keys**; it starts with `hub_live_` and is shown only once, so store it right away. A key belongs to one organization and can read and write all of that organization's contacts.

Send the key in whichever way your tool supports:

| Method | Example | Use when |
| --- | --- | --- |
| Bearer header (preferred) | `Authorization: Bearer hub_live_...` | Your code or tool can set headers |
| API key header | `X-API-Key: hub_live_...` | Tools such as Make that have an "API key" header field |
| Query parameter | `?api_key=hub_live_...` | The tool can only be given a URL, e.g. a plain HTML form's `action` |

Check a key with `GET /me`, which returns the organization and key name. A missing, wrong or revoked key returns `401`.

**Keeping keys safe**

- Keep keys on a server or inside an automation tool. Anything in a public web page, including a form's `action` URL, can be read by visitors.
- If you post a form straight from a public page, create a dedicated key for that form so you can revoke it on its own.
- Revoke a key in **Settings → API Keys**; it stops working on the next request.

## Requests and responses

The API accepts the body formats tools commonly send and always answers in JSON (or a redirect for HTML forms).

### Body formats

| Content-Type | Notes |
| --- | --- |
| `application/json` | Recommended |
| `application/x-www-form-urlencoded` | Plain HTML forms; repeated keys (`tags=a&tags=b`) become a list |
| `multipart/form-data` | Forms with file inputs; files are ignored |

### Field names are flexible

Field names are matched ignoring case, spaces, dashes and underscores, and common alternatives are accepted, so you can usually map a form or tool without renaming anything. Fields that match nothing are listed in the response under `meta.ignored_fields`; for form posts they are also saved on the contact's timeline entry.

| Field | Also accepted |
| --- | --- |
| `first_name` | firstName, First Name, fname, given_name, first |
| `last_name` | lastName, Last Name, lname, surname, family_name, last |
| `name` | full_name, your_name, contact_name (split into first and last) |
| `email` | email_address, mail, your_email, work_email |
| `phone` | phone_number, mobile, cell, tel, telephone, whatsapp |
| `job_title` | title, position, role |
| `company` | company_name, organization, business, business_name |
| `source` | lead_source, utm_source |
| `campaign` | utm_campaign |
| `lifecycle_stage` | stage, lifecycle |
| `lead_score` | score |
| `consent_status` | consent, marketing_consent, gdpr_consent (a checkbox value such as "on" or "yes" counts as granted) |
| `sms_opt_out` | smsConsent (inverted: `true` means texts are allowed) |
| `tags` | tag, labels; an array or a comma-separated string |
| `note` | notes, message, comment, comments |
| `external_id` | externalId, ext_id |

Booleans accept `true/false`, `1/0`, `yes/no` and `on/off`.

### Successful responses

A single object is returned as `{ "data": {...}, "meta": {...} }`. Lists are returned as `{ "object": "list", "data": [...], "has_more": true, "next_cursor": "..." }`.

### Errors

Errors share one shape:

```json
{ "error": { "code": "conflict", "message": "A contact with this email already exists", "details": { "existing_contact_id": "6f1c..." } } }
```

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `invalid_request` | Missing or invalid field; `message` says which |
| 401 | `unauthorized` | Missing, wrong or revoked API key |
| 404 | `not_found` | No such contact in this organization |
| 409 | `conflict` | Email or external_id already belongs to another contact; `details.existing_contact_id` names it |
| 429 | `rate_limited` | Too many requests; wait for `Retry-After` seconds |
| 500 | `internal_error` | Unexpected server error; safe to retry |

### Rate limits

Each key may make **600 requests per minute**. Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` (Unix seconds). Over the limit you get `429` with a `Retry-After` header. To move many contacts, use batch upsert: 100 contacts per request count as one request.

### CORS

All origins are allowed, so a browser page can call the API directly. Read the key-safety notes under [Authentication](#authentication) first.

## The contact object

Every endpoint that returns a contact returns this shape.

```json
{
  "id": "6f1c2d7e-0b1a-4f43-9a55-3c1f0e2b9d10",
  "object": "contact",
  "external_id": "user_1842",
  "first_name": "Ada",
  "last_name": "Lovelace",
  "full_name": "Ada Lovelace",
  "email": "ada@example.com",
  "phone": "+1 555 010 0001",
  "job_title": "Mathematician",
  "company": { "id": "0c9b...", "name": "Analytical Engines Ltd", "domain": null },
  "source": "website",
  "campaign": "spring-launch",
  "lifecycle_stage": "lead",
  "lead_score": 40,
  "consent_status": "granted",
  "email_opt_out": false,
  "sms_opt_out": false,
  "owner_id": null,
  "tags": ["Newsletter", "VIP"],
  "custom_fields": { "budget": 5000, "industry": "Finance" },
  "created_at": "2026-10-12T09:30:00.123456+00:00",
  "updated_at": "2026-10-12T09:41:12.004211+00:00"
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | The Hub's id. Read-only |
| `external_id` | string, max 255 | Your system's id for the person. Unique per organization; use it to upsert and look up |
| `first_name`, `last_name` | string, max 200 | Send `name` instead to have it split for you |
| `full_name` | string | Read-only |
| `email` | string, max 320 | Stored lowercase. Unique per organization |
| `phone` | string, max 50 | Any format; matching ignores everything but digits |
| `job_title` | string | |
| `company` | object or null | Write `company` (a name, found or created, case-insensitive) or `company_id`. With neither, a new contact is linked to an existing company whose domain matches the email |
| `source` | string | Where the contact first came from. Upsert never overwrites a source that is already set |
| `campaign` | string | |
| `lifecycle_stage` | enum | `subscriber`, `lead` (default), `mql`, `sql`, `opportunity`, `customer`, `evangelist`, `other` |
| `lead_score` | integer 0-100 | Default 0 |
| `consent_status` | enum | `unknown` (default), `granted`, `revoked` |
| `email_opt_out`, `sms_opt_out` | boolean | Default false |
| `owner_id` | UUID or null | Read-only via the API |
| `tags` | string[] | Write with `tags` (add) and `remove_tags` (remove). Unknown tag names are created |
| `custom_fields` | object | Keyed by field key; see below |
| `note` | string, write-only | Adds a timeline entry when creating or updating |
| `created_at`, `updated_at` | ISO 8601 | Read-only |

A new contact needs at least one of: email, phone, external_id or a name.

### Custom fields

Custom fields are defined in **Settings → Custom Fields**. `GET /contacts/fields` lists their keys and types. Write them in a `custom_fields` object, or as top-level fields whose names match the key (handy for form inputs). Values are checked against the field type:

| Type | Accepts |
| --- | --- |
| text | Any string up to 5,000 characters |
| number | A number or numeric string |
| date | `YYYY-MM-DD` or ISO 8601; stored as a date |
| boolean | `true/false`, `yes/no`, `on/off`, `1/0` |
| select | One of the field's options |
| multiselect | An array or comma-separated string of the field's options |

An unknown key in `custom_fields` returns `400`. Send `null` to clear a value (PATCH only).

## Endpoints

All paths are relative to `https://custom-crm-hub.vercel.app/api/v1`.

### POST /contacts/upsert

Creates or updates a contact. This is the endpoint to use for forms, automations and syncs.

The contact is matched in this order, and the first hit wins:

1. `id` (returns `404` if no such contact)
2. `external_id`
3. `email`
4. `phone` (digits only, at least 6)

When a match is found:

- Values you send overwrite stored values; empty or missing values never erase anything.
- `source` is set only if the contact has none yet.
- If the match was by phone and the contact already has a different email, the email is kept.
- `tags` are added, `remove_tags` removed, and `note` adds a timeline entry.

**Response:** `201` when created, `200` when updated. `meta` holds `created`, `matched_by` (`id`, `external_id`, `email`, `phone` or `null`) and `ignored_fields`.

```json
{
  "data": { "id": "6f1c...", "object": "contact", "email": "ada@example.com", "...": "..." },
  "meta": { "created": false, "matched_by": "email", "ignored_fields": [] }
}
```

**Batch:** send `{ "contacts": [ ... ] }` (or a bare array) with up to 100 contacts. Each row is processed on its own, so one bad row does not fail the rest. The response is always `200` with a result per row, in input order:

```json
{
  "object": "batch_result",
  "data": [
    { "index": 0, "status": "created", "id": "6f1c...", "matched_by": null },
    { "index": 1, "status": "updated", "id": "a2b9...", "matched_by": "email" },
    { "index": 2, "status": "error", "error": { "code": "invalid_request", "message": "email is not a valid email address" } }
  ],
  "meta": { "total": 3, "created": 1, "updated": 1, "failed": 1, "ignored": 0 }
}
```

### GET /contacts

Lists contacts, newest first by default. Results are paged with a cursor: pass `next_cursor` from one response as `cursor` in the next until `has_more` is `false`. Paging stays fast however many contacts there are.

| Parameter | Description |
| --- | --- |
| `limit` | 1-100, default 25 |
| `cursor` | `next_cursor` from the previous page |
| `sort` | `created_at` (default) or `updated_at` |
| `order` | `desc` (default) or `asc` |
| `q` | Search first name, last name, email and phone |
| `email` | Exact email (case-insensitive) |
| `phone` | Phone in any format; digits are compared |
| `external_id` | Exact external id |
| `tag` | Tag name; comma-separate several to match any of them |
| `lifecycle_stage`, `source`, `campaign`, `company_id` | Exact match |
| `created_after`, `created_before` | ISO 8601 date/time |
| `updated_since` | ISO 8601; contacts changed at or after this time |
| `include_total` | `true` adds `total` (slower on large organizations) |

```bash
curl "https://custom-crm-hub.vercel.app/api/v1/contacts?tag=Newsletter&limit=50" \
  -H "Authorization: Bearer hub_live_YOUR_KEY"
```

### POST /contacts

Creates a contact. Returns `201` with the contact, or `409` with `details.existing_contact_id` if the email or external_id is already taken. Use upsert when you do not want that check.

### GET /contacts/{id}

Returns one contact, or `404`.

### PATCH /contacts/{id}

Updates only the fields you send. Unlike upsert, `null` clears a field. `tags` adds tags and `remove_tags` removes them; other tags are untouched. `PUT` behaves the same way, for tools that only offer PUT. Returns the updated contact.

```json
{ "lifecycle_stage": "customer", "phone": null, "remove_tags": ["Trial"] }
```

### DELETE /contacts/{id}

Permanently deletes the contact with its timeline, notes, tags and files. Returns `{ "data": { "id": "...", "object": "contact", "deleted": true } }`.

### POST and DELETE /contacts/{id}/tags

Adds or removes tags. Send `{ "tags": ["VIP", "Webinar"] }` or `?tags=VIP,Webinar`. Adding creates tags that do not exist yet; removing never deletes the tag itself. Returns the updated contact.

### GET /contacts/{id}/activities

Returns the contact's timeline, newest first. `limit` is 1-100 (default 25). For the next page pass the response's `next_before` as `before`.

### POST /contacts/{id}/activities

Adds a timeline entry, for example a call made in another tool or an email your platform sent. Returns `201`.

| Field | Description |
| --- | --- |
| `type` | `note` (default), `call`, `email`, `sms`, `meeting`, `form_submission`, `other` |
| `body` | Required, up to 20,000 characters |
| `metadata` | Optional object, up to 20 KB |
| `occurred_at` | Optional ISO 8601; defaults to now |

```json
{ "type": "call", "body": "Intro call, interested in the Pro plan", "metadata": { "duration_seconds": 300 } }
```

### GET /contacts/fields

Lists every writable contact field with its type, plus the organization's custom fields with their keys and options. Integration tools can use it to build field mappings.

### GET /tags

Lists the organization's tags (id, name, color), up to 1,000.

### GET /me

Returns the organization and the key's name. Use it as a connection test.

## Website forms

A plain HTML form can post straight to the API with no code. Point its `action` at the upsert endpoint with the key and a thank-you page in the URL:

```html
<form method="POST"
      action="https://custom-crm-hub.vercel.app/api/v1/contacts/upsert?api_key=hub_live_FORM_KEY&redirect=https://yoursite.com/thanks">
  <input name="First Name" required>
  <input name="Last Name">
  <input name="Email" type="email" required>
  <input name="Phone">
  <textarea name="Message"></textarea>
  <input type="hidden" name="source" value="website">
  <input type="hidden" name="tags" value="Contact form">
  <!-- Spam trap: hidden from people, filled in by bots -->
  <input name="_gotcha" style="display:none" tabindex="-1" autocomplete="off">
  <button type="submit">Send</button>
</form>
```

What happens on submit:

- **Redirect:** the visitor is sent to `redirect` (or a `_redirect` form field) with a `303`. Without one, the browser shows the JSON response. Only `http` and `https` addresses are followed.
- **Matching:** the form uses upsert rules, so a returning visitor updates their existing contact. Empty inputs never erase stored values.
- **Timeline:** each submission adds a `form_submission` entry to the contact. Its text is the message field, or "Form submitted" when there is none; the entry also stores every input that did not map to a contact field (for example `utm_medium`).
- **Spam:** if `_gotcha`, `_honeypot` or `hp` has a value, the request is accepted and nothing is saved.
- **Ignored:** fields starting with `_`, `submit`, and captcha tokens (`g-recaptcha-response`, `cf-turnstile-response`, `h-captcha-response`).

Form builders that send webhooks (Webflow, Typeform, Tally, Jotform, WordPress plugins) work the same way: set the webhook URL to the upsert endpoint and add the key as a header, or as `?api_key=` if headers are not supported. Form tools usually send a nested or vendor-specific payload; if fields arrive under `meta.ignored_fields`, route the webhook through Zapier, Make or n8n to map them.

## Webhooks

Webhooks push contact changes to your system as they happen, so you do not need to poll. Add an endpoint in **Settings → API Keys → Webhooks**, choose its events, then open **Edit** to copy its signing secret.

| Event | Sent when |
| --- | --- |
| `contact.created` | A contact is created, through the API or in The Hub |
| `contact.updated` | A contact is edited in The Hub, or updated, upserted or re-tagged through the API |
| `contact.deleted` | A contact is deleted through the API; `data.contact` is its last state |

Each delivery is a `POST` with a JSON body:

```json
{
  "id": "evt_4b0c1f...",
  "event": "contact.updated",
  "created_at": "2026-10-12T09:41:12.512Z",
  "organization_id": "b12b...",
  "data": { "contact": { "id": "6f1c...", "object": "contact", "...": "..." } }
}
```

| Header | Value |
| --- | --- |
| `X-Hub-Event` | The event name |
| `X-Hub-Delivery` | The event `id`; use it to ignore duplicates |
| `X-Hub-Timestamp` | Unix seconds when the delivery was signed |
| `X-Hub-Signature` | `sha256=` + hex HMAC-SHA256 of `{timestamp}.{raw body}`, keyed by the signing secret |

Verify every delivery before trusting it. In Node.js:

```js
import { createHmac, timingSafeEqual } from "node:crypto";

function isValidHubWebhook(rawBody, headers, secret) {
  const timestamp = headers["x-hub-timestamp"];
  const expected = "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const received = headers["x-hub-signature"] ?? "";
  const fresh = Math.abs(Date.now() / 1000 - Number(timestamp)) < 300; // reject replays older than 5 minutes
  return fresh && received.length === expected.length && timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
```

Respond with any `2xx` within 5 seconds. Deliveries are not retried; each attempt and its status code are listed under **Deliveries** for the endpoint. To recover from missed events, call `GET /contacts?updated_since=...` for the gap.

## Recipes

### Zapier, Make and n8n

Use the generic HTTP / webhook action; no app install is needed.

| Setting | Value |
| --- | --- |
| Method | `POST` |
| URL | `https://custom-crm-hub.vercel.app/api/v1/contacts/upsert` |
| Headers | `Authorization: Bearer hub_live_...` and `Content-Type: application/json` |
| Body | JSON mapping your trigger's fields, e.g. `{"name": "...", "email": "...", "tags": ["Zapier"]}` |
| Connection test | `GET /me` |

To react to changes in The Hub, add a webhook endpoint (see [Webhooks](#webhooks)) pointing at the tool's "catch hook" URL.

### Your own backend

```js
const res = await fetch("https://custom-crm-hub.vercel.app/api/v1/contacts/upsert", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.HUB_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ external_id: user.id, email: user.email, name: user.name, source: "app-signup", tags: ["Customer"] }),
});
const json = await res.json();
if (!res.ok) throw new Error(json.error.message);
const { data: contact, meta } = json; // meta.created tells you if it was new
```

Send your own user id as `external_id`. Later calls then find the same contact even if the person changes their email.

### Bulk import or nightly sync

Send contacts in batches of 100 to `POST /contacts/upsert` and check each row's `status`. To pull changes out of The Hub, store the time of your last sync and page through `GET /contacts?updated_since=<last sync>&sort=updated_at&order=asc` until `has_more` is `false`.

### Logging activity from another tool

When your phone system, email platform or booking tool does something with a contact, find it with `GET /contacts?email=...` (or keep its `id`), then `POST /contacts/{id}/activities` with `type` `call`, `email`, `sms` or `meeting` so it appears on the contact's timeline.

### Existing endpoints

The older `POST /api/public/leads` (Lead Nurture Workflow) and `POST /api/public/contacts` (Instagram bot) endpoints keep working unchanged. New integrations should use v1.
