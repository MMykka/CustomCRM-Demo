import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/publicApi";
import { createAdminClient } from "@/lib/supabase/admin";

interface ContactUpsertBody {
  /** The caller's own id for this person (e.g. "ig:1527731925827923"), kept in activity metadata. */
  externalId?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  campaign?: string | null;
  leadScore?: number;
  /** Tag names to add (created if missing). */
  tags?: string[];
  /** Tag names to remove, e.g. "Not Potential" when a lead becomes "Potential". */
  removeTags?: string[];
  /** true = the person agreed to texts, false = they opted out (STOP). */
  smsConsent?: boolean;
  /** Timeline entry for this update, e.g. "Qualified by the AI Instagram bot (score 75)". */
  note?: string | null;
}

function splitName(name: string): { firstName: string | null; lastName: string | null } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: null };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

const cleanTags = (tags: unknown): string[] =>
  Array.isArray(tags) ? [...new Set(tags.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean))] : [];

// Generic contact upsert for external apps (currently: the AI Instagram setter
// bot). Unlike /api/public/leads (Lead Nurture Workflow), it accepts phone-only
// contacts, sets tags and lead score directly, and is safe to call repeatedly
// as the caller learns more about the person: the contact is matched by email,
// then by phone, and updated in place. Authenticated via api_keys (see
// src/lib/publicApi.ts); /api/public is in PUBLIC_PATHS.
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const body: ContactUpsertBody = await req.json().catch(() => ({}));
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() || null;
  const phone = body.phone?.trim() || null;
  const phoneDigits = phone?.replace(/[^0-9]/g, "") ?? "";

  if (!name || (!email && !phoneDigits)) {
    return NextResponse.json({ error: "name and at least one of email or phone are required" }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "email is not valid" }, { status: 400 });
  }
  if (body.leadScore !== undefined && (!Number.isInteger(body.leadScore) || body.leadScore < 0 || body.leadScore > 100)) {
    return NextResponse.json({ error: "leadScore must be an integer from 0 to 100" }, { status: 400 });
  }

  const addTags = cleanTags(body.tags);
  const removeTags = cleanTags(body.removeTags).filter((t) => !addTags.includes(t));

  const supabase = createAdminClient();
  const { organizationId } = auth;

  // Match by email first, then by phone, so a person who gives their phone
  // first and email later stays one contact.
  let existing: { id: string; email: string | null; phone: string | null; source: string | null } | null = null;
  if (email) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, email, phone, source")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    existing = data;
  }
  if (!existing && phoneDigits) {
    const { data, error } = await supabase
      .from("contacts")
      .select("id, email, phone, source")
      .eq("organization_id", organizationId)
      .eq("phone_normalized", phoneDigits)
      .limit(1)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    existing = data;
  }

  const { firstName, lastName } = splitName(name);
  const consentFields =
    body.smsConsent === undefined
      ? {}
      : {
          sms_opt_out: !body.smsConsent,
          consent_status: body.smsConsent ? "granted" : "revoked",
          consent_updated_at: new Date().toISOString(),
        };

  let contactId: string;
  const created = !existing;

  if (!existing) {
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        organization_id: organizationId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        source: body.source?.trim() || null,
        campaign: body.campaign?.trim() || null,
        lead_score: body.leadScore ?? 0,
        lifecycle_stage: "lead",
        ...consentFields,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    contactId = data.id;
  } else {
    contactId = existing.id;
    const { error } = await supabase
      .from("contacts")
      .update({
        first_name: firstName,
        last_name: lastName,
        // Fill in details we didn't have; never blank out existing ones.
        ...(email && !existing.email ? { email } : {}),
        ...(phone ? { phone } : {}),
        // Keep the original source: it records where the contact first came from.
        ...(!existing.source && body.source?.trim() ? { source: body.source.trim() } : {}),
        ...(body.campaign !== undefined ? { campaign: body.campaign?.trim() || null } : {}),
        ...(body.leadScore !== undefined ? { lead_score: body.leadScore } : {}),
        ...consentFields,
      })
      .eq("id", contactId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const tagName of addTags) {
    const { data: existingTag } = await supabase
      .from("tags")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("name", tagName)
      .maybeSingle();
    let tagId = existingTag?.id ?? null;
    if (!tagId) {
      const { data: newTag, error: tagError } = await supabase
        .from("tags")
        .insert({ organization_id: organizationId, name: tagName })
        .select("id")
        .single();
      if (tagError) return NextResponse.json({ error: tagError.message }, { status: 500 });
      tagId = newTag.id;
    }
    await supabase
      .from("contact_tags")
      .upsert({ contact_id: contactId, tag_id: tagId, organization_id: organizationId }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
  }

  if (removeTags.length) {
    const { data: tagsToRemove } = await supabase
      .from("tags")
      .select("id")
      .eq("organization_id", organizationId)
      .in("name", removeTags);
    const ids = (tagsToRemove ?? []).map((t) => t.id);
    if (ids.length) {
      await supabase.from("contact_tags").delete().eq("contact_id", contactId).in("tag_id", ids);
    }
  }

  if (body.note?.trim()) {
    await supabase.from("activities").insert({
      organization_id: organizationId,
      contact_id: contactId,
      type: "note",
      body: body.note.trim(),
      metadata: { source: body.source?.trim() || "public_api", externalId: body.externalId ?? null, leadScore: body.leadScore ?? null },
    });
  }

  return NextResponse.json({ contactId, created }, { status: 200 });
}
