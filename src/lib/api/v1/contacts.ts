import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/database.types";
import { findCompanyIdForEmail } from "@/lib/companies";
import { deliver, subscribedEndpoints } from "@/lib/webhooks";
import type { CustomFieldType, LifecycleStage, WebhookEventType } from "@/lib/types";
import { ApiError, badRequest } from "./http";

// Contact read/write logic for the public v1 API. Every query here runs on
// the service-role client (an API caller has no Supabase session), so RLS is
// bypassed and EVERY query must filter by organization_id explicitly.

type Admin = SupabaseClient<Database>;

export const LIFECYCLE_STAGES: LifecycleStage[] = ["subscriber", "lead", "mql", "sql", "opportunity", "customer", "evangelist", "other"];
export const CONSENT_STATUSES = ["unknown", "granted", "revoked"] as const;
export const MAX_BATCH_SIZE = 100;

// Input normalization ---------------------------------------------------------

export interface ContactInput {
  id?: string;
  external_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  source?: string | null;
  campaign?: string | null;
  lifecycle_stage?: LifecycleStage;
  lead_score?: number;
  consent_status?: (typeof CONSENT_STATUSES)[number];
  email_opt_out?: boolean;
  sms_opt_out?: boolean;
  company?: string | null;
  company_id?: string | null;
  tags: string[];
  remove_tags: string[];
  custom_fields: Record<string, unknown>;
  note?: string | null;
  /** Fields we didn't recognise -- kept in timeline metadata for form posts, echoed back as ignored_fields. */
  extra: Record<string, unknown>;
  /** A spam-trap field was filled in: accept the request but store nothing. */
  honeypot: boolean;
}

// Different tools name the same field differently ("First Name", firstName,
// first_name, fname...). Keys are compared lowercased with everything but
// letters/digits stripped, then mapped to our canonical field.
const ALIASES: Record<string, string> = {};
const alias = (canonical: string, ...names: string[]) => names.forEach((n) => (ALIASES[n] = canonical));
alias("id", "id", "contactid");
alias("external_id", "externalid", "extid", "externalcontactid");
alias("first_name", "firstname", "fname", "givenname", "first", "forename");
alias("last_name", "lastname", "lname", "surname", "familyname", "last");
alias("name", "name", "fullname", "yourname", "contactname");
alias("email", "email", "emailaddress", "mail", "youremail", "workemail");
alias("phone", "phone", "phonenumber", "mobile", "mobilephone", "mobilenumber", "cell", "cellphone", "tel", "telephone", "whatsapp", "yourphone");
alias("job_title", "jobtitle", "title", "position", "role");
alias("company", "company", "companyname", "organization", "organisation", "business", "businessname");
alias("company_id", "companyid");
alias("source", "source", "leadsource", "utmsource");
alias("campaign", "campaign", "utmcampaign");
alias("lifecycle_stage", "lifecyclestage", "lifecycle", "stage");
alias("lead_score", "leadscore", "score");
alias("consent_status", "consentstatus", "consent", "marketingconsent", "gdprconsent");
alias("email_opt_out", "emailoptout", "unsubscribed");
alias("sms_opt_out", "smsoptout");
alias("sms_consent", "smsconsent");
alias("tags", "tags", "tag", "labels");
alias("remove_tags", "removetags", "untag", "untags");
alias("custom_fields", "customfields", "properties");
alias("note", "note", "notes", "message", "comment", "comments");

// Never treated as data: transport/auth/form plumbing and captcha tokens.
const IGNORED_KEYS = new Set(["apikey", "redirect", "submit", "grecaptcharesponse", "cfturnstileresponse", "hcaptcharesponse"]);
const HONEYPOT_KEYS = new Set(["gotcha", "honeypot", "hp"]);

const normKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");

const LIMITS: Record<string, number> = { first_name: 200, last_name: 200, email: 320, phone: 50, external_id: 255, note: 20000 };

function str(field: string, value: unknown, isForm: boolean): string | null | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) value = value[value.length - 1];
  if (value === null) return null;
  if (typeof value === "number" || typeof value === "boolean") value = String(value);
  if (typeof value !== "string") throw badRequest(`${field} must be a string`);
  const trimmed = value.trim();
  // An empty form input means "not filled in", not "erase what you have".
  if (!trimmed) return isForm ? undefined : null;
  const max = LIMITS[field] ?? 500;
  if (trimmed.length > max) throw badRequest(`${field} must be at most ${max} characters`);
  return trimmed;
}

function bool(field: string, value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) value = value[value.length - 1];
  if (typeof value === "boolean") return value;
  const s = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on", "y"].includes(s)) return true;
  if (["false", "0", "no", "off", "n"].includes(s)) return false;
  throw badRequest(`${field} must be a boolean`);
}

function list(field: string, value: unknown): string[] {
  if (value === undefined || value === null) return [];
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : null;
  if (!items) throw badRequest(`${field} must be an array of strings or a comma-separated string`);
  const out = items.map((t) => (typeof t === "string" ? t.trim() : typeof t === "number" ? String(t) : "")).filter(Boolean);
  if (out.some((t) => t.length > 100)) throw badRequest(`${field} entries must be at most 100 characters`);
  return [...new Set(out)];
}

function splitName(name: string): { first: string; last: string | null } {
  const parts = name.split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? name, last: parts.length > 1 ? parts.slice(1).join(" ") : null };
}

export function normalizeContactInput(raw: Record<string, unknown>, isForm: boolean): ContactInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw badRequest("Contact must be an object");

  const fields: Record<string, unknown> = {};
  const extra: Record<string, unknown> = {};
  let honeypot = false;

  for (const [key, value] of Object.entries(raw)) {
    const nk = normKey(key);
    if (HONEYPOT_KEYS.has(nk)) {
      if (value !== undefined && value !== null && String(value).trim() !== "") honeypot = true;
      continue;
    }
    if (key.startsWith("_") || IGNORED_KEYS.has(nk)) continue;
    const canonical = ALIASES[nk];
    if (canonical && !(canonical in fields)) fields[canonical] = value;
    else if (!canonical) extra[key] = value;
  }

  const input: ContactInput = { tags: list("tags", fields.tags), remove_tags: list("remove_tags", fields.remove_tags), custom_fields: {}, extra, honeypot };

  if (fields.id !== undefined) {
    const id = str("id", fields.id, isForm);
    if (id) input.id = id;
  }
  input.external_id = str("external_id", fields.external_id, isForm);
  input.first_name = str("first_name", fields.first_name, isForm);
  input.last_name = str("last_name", fields.last_name, isForm);

  // A single "name" fills first/last only where they weren't sent explicitly.
  const fullName = str("name", fields.name, isForm);
  if (fullName) {
    const { first, last } = splitName(fullName);
    if (input.first_name === undefined) input.first_name = first;
    if (input.last_name === undefined) input.last_name = last;
  }

  const email = str("email", fields.email, isForm);
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest("email is not a valid email address");
    input.email = email.toLowerCase();
  } else input.email = email;

  input.phone = str("phone", fields.phone, isForm);
  input.job_title = str("job_title", fields.job_title, isForm);
  input.source = str("source", fields.source, isForm);
  input.campaign = str("campaign", fields.campaign, isForm);
  input.company = str("company", fields.company, isForm);
  input.company_id = str("company_id", fields.company_id, isForm);
  input.note = str("note", fields.note, isForm);

  const stage = str("lifecycle_stage", fields.lifecycle_stage, isForm);
  if (stage) {
    const s = stage.toLowerCase() as LifecycleStage;
    if (!LIFECYCLE_STAGES.includes(s)) throw badRequest(`lifecycle_stage must be one of: ${LIFECYCLE_STAGES.join(", ")}`);
    input.lifecycle_stage = s;
  }

  if (fields.lead_score !== undefined && fields.lead_score !== null && fields.lead_score !== "") {
    const n = Number(Array.isArray(fields.lead_score) ? fields.lead_score.at(-1) : fields.lead_score);
    if (!Number.isInteger(n) || n < 0 || n > 100) throw badRequest("lead_score must be an integer from 0 to 100");
    input.lead_score = n;
  }

  // consent_status takes "granted"/"revoked"/"unknown", or a boolean-ish
  // checkbox value ("on", "yes", true) from a form's consent checkbox.
  const consent = fields.consent_status;
  if (consent !== undefined && consent !== null && consent !== "") {
    const s = String(Array.isArray(consent) ? consent.at(-1) : consent).trim().toLowerCase();
    if ((CONSENT_STATUSES as readonly string[]).includes(s)) input.consent_status = s as ContactInput["consent_status"];
    else input.consent_status = bool("consent_status", s) ? "granted" : "revoked";
  }

  input.email_opt_out = bool("email_opt_out", fields.email_opt_out);
  input.sms_opt_out = bool("sms_opt_out", fields.sms_opt_out);
  // smsConsent (the /api/public/contacts convention): true = may text, false = STOP.
  const smsConsent = bool("sms_consent", fields.sms_consent);
  if (smsConsent !== undefined) input.sms_opt_out = !smsConsent;

  if (fields.custom_fields !== undefined && fields.custom_fields !== null) {
    if (typeof fields.custom_fields !== "object" || Array.isArray(fields.custom_fields)) throw badRequest("custom_fields must be an object of { field_key: value }");
    input.custom_fields = { ...(fields.custom_fields as Record<string, unknown>) };
  }

  return input;
}

// Reading ---------------------------------------------------------------------

export const CONTACT_SELECT =
  "id, external_id, first_name, last_name, email, phone, job_title, source, campaign, lifecycle_stage, lead_score, consent_status, email_opt_out, sms_opt_out, owner_id, company_id, created_at, updated_at, company:companies(id, name, domain), contact_tags(tags(name))";

interface ContactRow {
  id: string;
  external_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  source: string | null;
  campaign: string | null;
  lifecycle_stage: string;
  lead_score: number;
  consent_status: string;
  email_opt_out: boolean;
  sms_opt_out: boolean;
  owner_id: string | null;
  company_id: string | null;
  created_at: string;
  updated_at: string;
  company: { id: string; name: string; domain: string | null } | null;
  contact_tags: { tags: { name: string } | null }[];
}

export type CustomFieldDef = { id: string; field_key: string; name: string; field_type: CustomFieldType; options: Json | null };

export async function loadCustomFieldDefs(supabase: Admin, organizationId: string): Promise<CustomFieldDef[]> {
  const { data, error } = await supabase
    .from("custom_fields")
    .select("id, field_key, name, field_type, options")
    .eq("organization_id", organizationId)
    .eq("entity_type", "contact")
    .order("position");
  if (error) throw error;
  return (data ?? []) as CustomFieldDef[];
}

export async function serializeContacts(supabase: Admin, organizationId: string, rows: ContactRow[], defs?: CustomFieldDef[]) {
  const fieldDefs = defs ?? (await loadCustomFieldDefs(supabase, organizationId));
  const valuesByContact = new Map<string, Record<string, Json | null>>();

  if (fieldDefs.length && rows.length) {
    const keyById = new Map(fieldDefs.map((d) => [d.id, d.field_key]));
    const { data, error } = await supabase
      .from("custom_field_values")
      .select("entity_id, custom_field_id, value")
      .eq("organization_id", organizationId)
      .eq("entity_type", "contact")
      .in(
        "entity_id",
        rows.map((r) => r.id),
      );
    if (error) throw error;
    for (const v of data ?? []) {
      const key = keyById.get(v.custom_field_id);
      if (!key) continue;
      const bucket = valuesByContact.get(v.entity_id) ?? {};
      bucket[key] = v.value;
      valuesByContact.set(v.entity_id, bucket);
    }
  }

  return rows.map((r) => {
    const customFields: Record<string, Json | null> = {};
    for (const d of fieldDefs) customFields[d.field_key] = valuesByContact.get(r.id)?.[d.field_key] ?? null;
    return {
      id: r.id,
      object: "contact" as const,
      external_id: r.external_id,
      first_name: r.first_name,
      last_name: r.last_name,
      full_name: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
      email: r.email,
      phone: r.phone,
      job_title: r.job_title,
      company: r.company ? { id: r.company.id, name: r.company.name, domain: r.company.domain } : null,
      source: r.source,
      campaign: r.campaign,
      lifecycle_stage: r.lifecycle_stage,
      lead_score: r.lead_score,
      consent_status: r.consent_status,
      email_opt_out: r.email_opt_out,
      sms_opt_out: r.sms_opt_out,
      owner_id: r.owner_id,
      tags: r.contact_tags
        .map((ct) => ct.tags?.name)
        .filter((n): n is string => !!n)
        .sort(),
      custom_fields: customFields,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });
}

export type ApiContact = Awaited<ReturnType<typeof serializeContacts>>[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID_RE.test(s);

export async function getContact(supabase: Admin, organizationId: string, id: string): Promise<ApiContact | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await supabase.from("contacts").select(CONTACT_SELECT).eq("organization_id", organizationId).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [contact] = await serializeContacts(supabase, organizationId, [data as unknown as ContactRow]);
  return contact ?? null;
}

export async function getContactsByIds(supabase: Admin, organizationId: string, ids: string[]): Promise<ApiContact[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("contacts").select(CONTACT_SELECT).eq("organization_id", organizationId).in("id", ids);
  if (error) throw error;
  return serializeContacts(supabase, organizationId, (data ?? []) as unknown as ContactRow[]);
}

// Writing ---------------------------------------------------------------------

/**
 * Per-request caches shared across every contact in a batch, so 100 rows
 * with the same tags/company resolve them once instead of 100 times.
 */
export class WriteContext {
  readonly supabase = createAdminClient();
  private tagIds = new Map<string, string>();
  private companyIds = new Map<string, string>();
  private defs: CustomFieldDef[] | null = null;
  readonly events: { event: WebhookEventType; contactId: string }[] = [];

  constructor(readonly organizationId: string) {}

  async fieldDefs() {
    this.defs ??= await loadCustomFieldDefs(this.supabase, this.organizationId);
    return this.defs;
  }

  /** Finds or creates tags by exact name; safe under concurrent callers. */
  async tagIdsFor(names: string[]): Promise<string[]> {
    const missing = names.filter((n) => !this.tagIds.has(n));
    if (missing.length) {
      const { error: insertError } = await this.supabase
        .from("tags")
        .upsert(
          missing.map((name) => ({ organization_id: this.organizationId, name })),
          { onConflict: "organization_id,name", ignoreDuplicates: true },
        );
      if (insertError) throw insertError;
      const { data, error } = await this.supabase.from("tags").select("id, name").eq("organization_id", this.organizationId).in("name", missing);
      if (error) throw error;
      for (const t of data ?? []) this.tagIds.set(t.name, t.id);
    }
    return names.map((n) => this.tagIds.get(n)).filter((id): id is string => !!id);
  }

  async existingTagIds(names: string[]): Promise<string[]> {
    if (!names.length) return [];
    const { data, error } = await this.supabase.from("tags").select("id").eq("organization_id", this.organizationId).in("name", names);
    if (error) throw error;
    return (data ?? []).map((t) => t.id);
  }

  /** Finds a company by case-insensitive name, creating it if needed. */
  async companyIdFor(name: string): Promise<string> {
    const key = name.toLowerCase();
    const cached = this.companyIds.get(key);
    if (cached) return cached;
    const { data: found, error } = await this.supabase
      .from("companies")
      .select("id")
      .eq("organization_id", this.organizationId)
      .ilike("name", name.replace(/[\\%_]/g, (c) => `\\${c}`))
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    let id = found?.id;
    if (!id) {
      const { data: created, error: createError } = await this.supabase
        .from("companies")
        .insert({ organization_id: this.organizationId, name })
        .select("id")
        .single();
      if (createError) throw createError;
      id = created.id;
    }
    this.companyIds.set(key, id);
    return id;
  }
}

type ContactColumns = Database["public"]["Tables"]["contacts"]["Insert"];

async function companyColumn(wc: WriteContext, input: ContactInput): Promise<string | null | undefined> {
  if (input.company_id !== undefined) {
    if (input.company_id === null) return null;
    if (!isUuid(input.company_id)) throw badRequest("company_id must be a UUID");
    const { data } = await wc.supabase.from("companies").select("id").eq("organization_id", wc.organizationId).eq("id", input.company_id).maybeSingle();
    if (!data) throw badRequest("company_id does not match a company in this organization");
    return data.id;
  }
  if (input.company === null) return null;
  if (input.company) return wc.companyIdFor(input.company);
  return undefined;
}

function consentColumns(input: ContactInput): Partial<ContactColumns> {
  const cols: Partial<ContactColumns> = {};
  if (input.consent_status !== undefined) cols.consent_status = input.consent_status;
  if (input.email_opt_out !== undefined) cols.email_opt_out = input.email_opt_out;
  if (input.sms_opt_out !== undefined) cols.sms_opt_out = input.sms_opt_out;
  if (Object.keys(cols).length) cols.consent_updated_at = new Date().toISOString();
  return cols;
}

function coerceCustomValue(def: CustomFieldDef, value: unknown): Json | null {
  if (value === null || value === "") return null;
  const fail = (expected: string) => badRequest(`custom field "${def.field_key}" expects ${expected}`);
  const optionValues = Array.isArray(def.options) ? def.options.map((o) => (o && typeof o === "object" && "value" in o ? String(o.value) : String(o))) : null;
  switch (def.field_type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(String(value).trim());
      if (!Number.isFinite(n)) throw fail("a number");
      return n;
    }
    case "boolean": {
      const b = bool(def.field_key, value);
      if (b === undefined) return null;
      return b;
    }
    case "date": {
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) throw fail("a date (YYYY-MM-DD or ISO 8601)");
      return d.toISOString().slice(0, 10);
    }
    case "select": {
      const s = String(Array.isArray(value) ? value.at(-1) : value).trim();
      if (optionValues?.length && !optionValues.includes(s)) throw fail(`one of: ${optionValues.join(", ")}`);
      return s;
    }
    case "multiselect": {
      const arr = list(def.field_key, value);
      if (optionValues?.length && arr.some((v) => !optionValues.includes(v))) throw fail(`values from: ${optionValues.join(", ")}`);
      return arr;
    }
    default: {
      const s = String(Array.isArray(value) ? value.at(-1) : value).trim();
      if (s.length > 5000) throw fail("at most 5000 characters");
      return s;
    }
  }
}

/** Validates custom field input up front so a bad value fails the request before anything is written. */
async function resolveCustomFields(wc: WriteContext, input: ContactInput) {
  const defs = await wc.fieldDefs();
  const byKey = new Map(defs.map((d) => [normKey(d.field_key), d]));
  const resolved: { def: CustomFieldDef; value: Json | null }[] = [];

  for (const [key, value] of Object.entries(input.custom_fields)) {
    const def = byKey.get(normKey(key));
    if (!def) throw badRequest(`Unknown custom field "${key}". GET /api/v1/contacts/fields lists the available keys.`);
    resolved.push({ def, value: coerceCustomValue(def, value) });
  }
  // Unrecognised top-level keys that happen to match a custom field key (e.g.
  // a form input named "budget") are treated as that custom field.
  for (const [key, value] of Object.entries(input.extra)) {
    const def = byKey.get(normKey(key));
    if (!def || resolved.some((r) => r.def.id === def.id)) continue;
    resolved.push({ def, value: coerceCustomValue(def, value) });
    delete input.extra[key];
  }
  return resolved;
}

async function writeRelations(wc: WriteContext, contactId: string, input: ContactInput, customFields: { def: CustomFieldDef; value: Json | null }[], isForm: boolean, apiKeyName: string) {
  const { supabase, organizationId } = wc;

  if (input.tags.length) {
    const tagIds = await wc.tagIdsFor(input.tags);
    const { error } = await supabase
      .from("contact_tags")
      .upsert(
        tagIds.map((tag_id) => ({ contact_id: contactId, tag_id, organization_id: organizationId })),
        { onConflict: "contact_id,tag_id", ignoreDuplicates: true },
      );
    if (error) throw error;
  }

  const removeNames = input.remove_tags.filter((t) => !input.tags.includes(t));
  if (removeNames.length) {
    const ids = await wc.existingTagIds(removeNames);
    if (ids.length) {
      const { error } = await supabase.from("contact_tags").delete().eq("organization_id", organizationId).eq("contact_id", contactId).in("tag_id", ids);
      if (error) throw error;
    }
  }

  const toSet = customFields.filter((c) => c.value !== null);
  const toClear = customFields.filter((c) => c.value === null);
  if (toSet.length) {
    const { error } = await supabase.from("custom_field_values").upsert(
      toSet.map((c) => ({ organization_id: organizationId, custom_field_id: c.def.id, entity_type: "contact", entity_id: contactId, value: c.value })),
      { onConflict: "custom_field_id,entity_id" },
    );
    if (error) throw error;
  }
  if (toClear.length) {
    const { error } = await supabase
      .from("custom_field_values")
      .delete()
      .eq("organization_id", organizationId)
      .eq("entity_id", contactId)
      .in(
        "custom_field_id",
        toClear.map((c) => c.def.id),
      );
    if (error) throw error;
  }

  // Timeline entry: an explicit note, or every plain form post (so the raw
  // submission -- including fields we don't map -- is visible on the contact).
  if (input.note || isForm) {
    const { error } = await supabase.from("activities").insert({
      organization_id: organizationId,
      contact_id: contactId,
      type: isForm ? "form_submission" : "note",
      body: input.note || "Form submitted",
      metadata: { via: "api_v1", api_key: apiKeyName, ...(Object.keys(input.extra).length ? { fields: input.extra as Json } : {}) },
    });
    if (error) throw error;
  }
}

const isUniqueViolation = (e: unknown) => !!e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505";

function conflictError(existingId: string | null, field: string) {
  return new ApiError(409, "conflict", `A contact with this ${field} already exists`, existingId ? { existing_contact_id: existingId } : undefined);
}

async function findBy(wc: WriteContext, column: "id" | "external_id" | "email" | "phone_normalized", value: string) {
  const { data, error } = await wc.supabase
    .from("contacts")
    .select("id, email, phone, source, first_name, last_name")
    .eq("organization_id", wc.organizationId)
    .eq(column, value)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function explainConflict(wc: WriteContext, input: ContactInput, excludeId?: string): Promise<ApiError> {
  if (input.email) {
    const hit = await findBy(wc, "email", input.email);
    if (hit && hit.id !== excludeId) return conflictError(hit.id, "email");
  }
  if (input.external_id) {
    const hit = await findBy(wc, "external_id", input.external_id);
    if (hit && hit.id !== excludeId) return conflictError(hit.id, "external_id");
  }
  return conflictError(null, "email or external_id");
}

function requireIdentity(input: ContactInput) {
  if (!input.email && !input.phone && !input.external_id && !input.first_name && !input.last_name) {
    throw badRequest("A contact needs at least one of: email, phone, external_id, first_name/last_name/name");
  }
}

/** POST /contacts -- strict create; 409 if the email/external_id is taken. */
export async function createContact(wc: WriteContext, input: ContactInput, opts: { isForm: boolean; apiKeyName: string }) {
  requireIdentity(input);
  const customFields = await resolveCustomFields(wc, input);
  const companyId = (await companyColumn(wc, input)) ?? (await findCompanyIdForEmail(wc.supabase, wc.organizationId, input.email ?? null));

  const { data, error } = await wc.supabase
    .from("contacts")
    .insert({
      organization_id: wc.organizationId,
      external_id: input.external_id ?? null,
      first_name: input.first_name ?? null,
      last_name: input.last_name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      job_title: input.job_title ?? null,
      source: input.source ?? null,
      campaign: input.campaign ?? null,
      lifecycle_stage: input.lifecycle_stage ?? "lead",
      lead_score: input.lead_score ?? 0,
      company_id: companyId,
      ...consentColumns(input),
    })
    .select("id")
    .single();
  if (error) {
    if (isUniqueViolation(error)) throw await explainConflict(wc, input);
    throw error;
  }

  await writeRelations(wc, data.id, input, customFields, opts.isForm, opts.apiKeyName);
  wc.events.push({ event: "contact.created", contactId: data.id });
  return data.id;
}

/** PATCH /contacts/:id -- sets exactly the fields sent; null clears a field. */
export async function updateContact(wc: WriteContext, id: string, input: ContactInput, opts: { isForm: boolean; apiKeyName: string }) {
  const existing = isUuid(id) ? await findBy(wc, "id", id) : null;
  if (!existing) throw new ApiError(404, "not_found", "Contact not found");

  const customFields = await resolveCustomFields(wc, input);
  const companyId = await companyColumn(wc, input);
  const cols: Partial<ContactColumns> = { ...consentColumns(input) };
  for (const key of ["external_id", "first_name", "last_name", "email", "phone", "job_title", "source", "campaign", "lifecycle_stage", "lead_score"] as const) {
    if (input[key] !== undefined) (cols as Record<string, unknown>)[key] = input[key];
  }
  if (companyId !== undefined) cols.company_id = companyId;

  if (Object.keys(cols).length) {
    const { error } = await wc.supabase.from("contacts").update(cols).eq("organization_id", wc.organizationId).eq("id", existing.id);
    if (error) {
      if (isUniqueViolation(error)) throw await explainConflict(wc, input, existing.id);
      throw error;
    }
  }

  await writeRelations(wc, existing.id, input, customFields, opts.isForm, opts.apiKeyName);
  wc.events.push({ event: "contact.updated", contactId: existing.id });
  return existing.id;
}

export type MatchedBy = "id" | "external_id" | "email" | "phone" | null;

/**
 * POST /contacts/upsert -- the integration workhorse. Matches an existing
 * contact by id, then external_id, then email, then phone; updates it if
 * found, otherwise creates one. Safe to call repeatedly with partial data:
 * sent values overwrite, missing/empty ones never erase what's stored, and
 * `source` keeps its first value (it records where the contact came from).
 */
export async function upsertContact(
  wc: WriteContext,
  input: ContactInput,
  opts: { isForm: boolean; apiKeyName: string },
  attempt = 0,
): Promise<{ id: string; created: boolean; matchedBy: MatchedBy }> {
  requireIdentity(input);

  let existing: Awaited<ReturnType<typeof findBy>> = null;
  let matchedBy: MatchedBy = null;
  if (input.id) {
    if (!isUuid(input.id)) throw badRequest("id must be a UUID");
    existing = await findBy(wc, "id", input.id);
    if (!existing) throw new ApiError(404, "not_found", "Contact not found");
    matchedBy = "id";
  }
  if (!existing && input.external_id) [existing, matchedBy] = [await findBy(wc, "external_id", input.external_id), "external_id"];
  if (!existing && input.email) [existing, matchedBy] = [await findBy(wc, "email", input.email), "email"];
  const phoneDigits = input.phone?.replace(/[^0-9]/g, "") ?? "";
  if (!existing && phoneDigits.length >= 6) [existing, matchedBy] = [await findBy(wc, "phone_normalized", phoneDigits), "phone"];
  if (!existing) matchedBy = null;

  if (!existing) {
    try {
      const id = await createContact(wc, input, opts);
      return { id, created: true, matchedBy: null };
    } catch (err) {
      // Lost a race with a concurrent request creating the same person:
      // retry once, which will now match and update it instead.
      if (err instanceof ApiError && err.status === 409 && attempt === 0) return upsertContact(wc, input, opts, 1);
      throw err;
    }
  }

  const customFields = await resolveCustomFields(wc, input);
  const companyId = await companyColumn(wc, input);
  const cols: Partial<ContactColumns> = { ...consentColumns(input) };
  for (const key of ["external_id", "first_name", "last_name", "phone", "job_title", "campaign", "lifecycle_stage", "lead_score"] as const) {
    if (input[key] !== undefined && input[key] !== null) (cols as Record<string, unknown>)[key] = input[key];
  }
  // A phone-only match may be a shared/family number: fill a missing email
  // but don't overwrite a different one.
  if (input.email && (matchedBy !== "phone" || !existing.email)) cols.email = input.email;
  if (input.source && !existing.source) cols.source = input.source;
  if (companyId) cols.company_id = companyId;

  if (Object.keys(cols).length) {
    const { error } = await wc.supabase.from("contacts").update(cols).eq("organization_id", wc.organizationId).eq("id", existing.id);
    if (error) {
      if (isUniqueViolation(error)) throw await explainConflict(wc, input, existing.id);
      throw error;
    }
  }

  await writeRelations(
    wc,
    existing.id,
    input,
    customFields.filter((c) => c.value !== null),
    opts.isForm,
    opts.apiKeyName,
  );
  wc.events.push({ event: "contact.updated", contactId: existing.id });
  return { id: existing.id, created: false, matchedBy };
}

// Webhooks ----------------------------------------------------------------------

/** Sends queued contact.* events to subscribed webhook endpoints. Call from after(). */
export async function emitContactEvents(organizationId: string, events: { event: WebhookEventType; contactId: string; snapshot?: ApiContact }[]) {
  if (!events.length) return;
  try {
    const endpoints = await subscribedEndpoints(organizationId, [...new Set(events.map((e) => e.event))]);
    if (!endpoints.length) return;

    const supabase = createAdminClient();
    const needed = [...new Set(events.filter((e) => !e.snapshot).map((e) => e.contactId))];
    const fresh = new Map((await getContactsByIds(supabase, organizationId, needed)).map((c) => [c.id, c]));

    // Collapse repeats (e.g. one contact touched twice in a batch) to one delivery per event+contact.
    const seen = new Set<string>();
    for (const e of events) {
      const dedupeKey = `${e.event}:${e.contactId}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      const contact = e.snapshot ?? fresh.get(e.contactId);
      if (contact) await deliver(organizationId, endpoints, e.event, { contact });
    }
  } catch (err) {
    console.error("Failed to emit contact webhook events", err);
  }
}
