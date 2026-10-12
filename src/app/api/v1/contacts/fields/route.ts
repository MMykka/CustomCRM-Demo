import { json, preflight, withApi } from "@/lib/api/v1/http";
import { LIFECYCLE_STAGES, loadCustomFieldDefs } from "@/lib/api/v1/contacts";
import { createAdminClient } from "@/lib/supabase/admin";

export const OPTIONS = preflight;

const STANDARD_FIELDS = [
  { key: "first_name", type: "text", label: "First name" },
  { key: "last_name", type: "text", label: "Last name" },
  { key: "name", type: "text", label: "Full name (write-only; split into first/last)" },
  { key: "email", type: "email", label: "Email" },
  { key: "phone", type: "text", label: "Phone" },
  { key: "external_id", type: "text", label: "Your system's id for this contact" },
  { key: "job_title", type: "text", label: "Job title" },
  { key: "company", type: "text", label: "Company name (found or created)" },
  { key: "company_id", type: "uuid", label: "Company id" },
  { key: "source", type: "text", label: "Lead source" },
  { key: "campaign", type: "text", label: "Campaign" },
  { key: "lifecycle_stage", type: "select", label: "Lifecycle stage", options: LIFECYCLE_STAGES },
  { key: "lead_score", type: "number", label: "Lead score (0-100)" },
  { key: "consent_status", type: "select", label: "Marketing consent", options: ["unknown", "granted", "revoked"] },
  { key: "email_opt_out", type: "boolean", label: "Email opt-out" },
  { key: "sms_opt_out", type: "boolean", label: "SMS opt-out" },
  { key: "tags", type: "multiselect", label: "Tags to add" },
  { key: "remove_tags", type: "multiselect", label: "Tags to remove" },
  { key: "note", type: "text", label: "Note for the contact's timeline (write-only)" },
];

// GET /api/v1/contacts/fields -- everything a contact can hold, including
// this org's custom fields, so integration tools can build field mappings.
export const GET = withApi(async (_req, { organizationId }) => {
  const defs = await loadCustomFieldDefs(createAdminClient(), organizationId);
  return json({
    data: {
      standard_fields: STANDARD_FIELDS,
      custom_fields: defs.map((d) => ({ key: d.field_key, label: d.name, type: d.field_type, options: d.options })),
    },
  });
});
