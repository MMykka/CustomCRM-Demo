import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/publicApi";
import { createAdminClient } from "@/lib/supabase/admin";

type LeadSyncEvent =
  | "created"
  | "email_sent"
  | "removed_already_booked"
  | "webinar_booked"
  | "reminder_sent"
  | "converted"
  | "escalated";

interface LeadSyncBody {
  externalId?: string;
  name?: string;
  email?: string;
  phone?: string | null;
  source?: string | null;
  campaign?: string | null;
  event?: LeadSyncEvent;
  emailStep?: 0 | 2 | 5;
  reminderKind?: "24h" | "1h";
  reason?: string | null;
}

function splitName(name: string): { firstName: string | null; lastName: string | null } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: null };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

function tagAndActivityFor(
  event: LeadSyncEvent,
  emailStep: 0 | 2 | 5 | undefined,
  reason: string | null | undefined,
  reminderKind: "24h" | "1h" | undefined,
) {
  switch (event) {
    case "created":
      return { tagName: "Nurture: Day 0 Sent", activityType: "email" as const, body: "Nurture sequence started - Day 0 email sent" };
    case "email_sent":
      return { tagName: `Nurture: Day ${emailStep} Sent`, activityType: "email" as const, body: `Nurture email sent (Day ${emailStep})` };
    case "removed_already_booked":
      return {
        tagName: `Nurture: Day ${emailStep} Removed (Already Booked)`,
        activityType: "note" as const,
        body: `Day ${emailStep} nurture email removed from follow-ups - lead had already booked their webinar spot`,
      };
    case "webinar_booked":
      return {
        tagName: "Nurture: Webinar Booked",
        activityType: "note" as const,
        body: "Lead booked their webinar spot via the email link",
      };
    case "reminder_sent":
      return {
        tagName: `Nurture: Reminder Sent (${reminderKind ?? "?"})`,
        activityType: "email" as const,
        body: `Webinar reminder email sent (${reminderKind ?? "unknown"} before start)`,
      };
    case "converted":
      return { tagName: "Nurture: Booked/Converted", activityType: "note" as const, body: "Lead marked converted in the Lead Nurture Workflow app" };
    case "escalated":
      return {
        tagName: "Nurture: Escalated",
        activityType: "note" as const,
        body: reason ? `Lead escalated in the Lead Nurture Workflow app: ${reason}` : "Lead escalated in the Lead Nurture Workflow app",
      };
  }
}

// Public intake endpoint for external apps (currently: the Lead Nurture
// Workflow) to push real leads in and keep a contact's nurture status
// current. Authenticated via api_keys (see src/lib/publicApi.ts), not a
// Supabase session -- see PUBLIC_PATHS in src/lib/supabase/middleware.ts.
export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const body: LeadSyncBody = await req.json().catch(() => ({}));
  const email = body.email?.trim().toLowerCase();
  const event = body.event;

  if (!email || !event) {
    return NextResponse.json({ error: "email and event are required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { organizationId } = auth;

  const { data: existing, error: findError } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("email", email)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  let contactId = existing?.id ?? null;

  if (!contactId) {
    const { firstName, lastName } = splitName(body.name ?? "");
    const { data: created, error: insertError } = await supabase
      .from("contacts")
      .insert({
        organization_id: organizationId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: body.phone?.trim() || null,
        source: body.source?.trim() || null,
        campaign: body.campaign?.trim() || null,
        lifecycle_stage: "lead",
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    contactId = created.id;
  } else {
    // Matched an existing contact by email - refresh name/phone to the
    // latest submission rather than letting the first-ever touch win
    // forever. Only touches fields the caller actually sent a name for, so
    // an event with no name (there currently isn't one) can't blank it out.
    const { firstName, lastName } = splitName(body.name ?? "");
    if (firstName) {
      const { error: updateError } = await supabase
        .from("contacts")
        .update({
          first_name: firstName,
          last_name: lastName,
          ...(body.phone?.trim() ? { phone: body.phone.trim() } : {}),
        })
        .eq("id", contactId);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }
  }

  if (event === "converted") {
    const { error: updateError } = await supabase.from("contacts").update({ lifecycle_stage: "customer" }).eq("id", contactId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const { tagName, activityType, body: activityBody } = tagAndActivityFor(event, body.emailStep, body.reason, body.reminderKind);

  const { data: existingTag } = await supabase.from("tags").select("id").eq("organization_id", organizationId).eq("name", tagName).maybeSingle();

  let tagId = existingTag?.id ?? null;
  if (!tagId) {
    const { data: newTag, error: tagError } = await supabase.from("tags").insert({ organization_id: organizationId, name: tagName }).select("id").single();
    if (tagError) {
      return NextResponse.json({ error: tagError.message }, { status: 500 });
    }
    tagId = newTag.id;
  }

  await supabase
    .from("contact_tags")
    .upsert({ contact_id: contactId, tag_id: tagId, organization_id: organizationId }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });

  await supabase.from("activities").insert({
    organization_id: organizationId,
    contact_id: contactId,
    type: activityType,
    body: activityBody,
    metadata: { source: "lead_nurture_workflow", externalId: body.externalId ?? null, event, emailStep: body.emailStep ?? null },
  });

  return NextResponse.json({ contactId }, { status: 200 });
}
