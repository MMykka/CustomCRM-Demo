import type { Tables } from "@/lib/supabase/database.types";

// Narrower literal-union views of the DB's CHECK-constrained "string"
// columns. `supabase gen types` can't see CHECK constraints (only real
// Postgres enums), so these mirror them by hand from the migrations.
export type DealStatus = "open" | "won" | "lost";
export type ActivityType =
  | "note"
  | "call"
  | "email"
  | "sms"
  | "meeting"
  | "stage_change"
  | "task_completed"
  | "form_submission"
  | "other";
export type TaskStatus = "open" | "completed" | "cancelled";
export type TaskPriority = "low" | "normal" | "high";
export type UserRole = "owner" | "admin" | "member";
export type NotificationType = "task_assigned" | "mention" | "reply" | "other";
export type LifecycleStage = "subscriber" | "lead" | "mql" | "sql" | "opportunity" | "customer" | "evangelist" | "other";
export type ConsentStatus = "unknown" | "granted" | "revoked";
export type CallOutcome = "connected" | "voicemail" | "no_answer" | "busy";

export type Contact = Tables<"contacts">;
export type Company = Tables<"companies">;
export type Deal = Tables<"deals">;
export type Pipeline = Tables<"pipelines">;
export type Stage = Tables<"stages">;
export type Activity = Tables<"activities">;
export type Task = Tables<"tasks">;
export type Tag = Tables<"tags">;
export type AppUser = Tables<"users">;
export type CustomField = Tables<"custom_fields">;
export type CustomFieldValue = Tables<"custom_field_values">;
export type Organization = Tables<"organizations">;
export type OrganizationMember = Tables<"organization_members">;
export type Notification = Tables<"notifications">;
export type Note = Tables<"notes">;
export type ContactFile = Tables<"files">;
export type SavedView = Tables<"saved_views">;
export type Message = Tables<"messages">;
export type SequenceEnrollment = Tables<"sequence_enrollments">;
export type DealLineItem = Tables<"deal_line_items">;

export const DEAL_WON_REASONS = ["Competitive win", "Timing", "Budget approved", "Other"] as const;
export const DEAL_LOST_REASONS = ["Price", "Timing", "No budget", "Chose competitor", "No response", "Other"] as const;

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  subscriber: "Subscriber",
  lead: "Lead",
  mql: "MQL",
  sql: "SQL",
  opportunity: "Opportunity",
  customer: "Customer",
  evangelist: "Evangelist",
  other: "Other",
};

export function contactDisplayName(contact: Pick<Contact, "first_name" | "last_name" | "email">) {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
  return name || contact.email || "Unnamed contact";
}

export function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
}
