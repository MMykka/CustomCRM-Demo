"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";
import type { Database } from "@/lib/supabase/database.types";

type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];

export type TargetField =
  | "skip"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "job_title"
  | "source"
  | "lifecycle_stage"
  | "company_name"
  | "owner_email"
  | "tag_names";

export type ImportRowInput = {
  rowIndex: number;
  values: Record<string, string>;
  action: "create" | "update" | "skip";
  existingContactId?: string;
};

// Lightweight org-wide index used for client-side dedupe preview during
// CSV import -- exact email/phone matching only (no trigram fuzzy pass in
// JS; the on-page duplicate banner already covers the fuzzy case via the
// find_contact_duplicates RPC).
export async function listContactMatchIndex() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contacts")
    .select("id, email, phone_normalized, first_name, last_name")
    .eq("organization_id", appUser.organization_id!)
    .limit(5000);

  if (error) throw error;

  return (data ?? []).map((c) => ({
    id: c.id,
    emailLower: c.email?.toLowerCase() ?? null,
    phoneNormalized: c.phone_normalized || null,
    fullNameLower: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim().toLowerCase(),
  }));
}

export async function importContactsChunk(rows: ImportRowInput[], mapping: Record<string, TargetField>) {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const result = { created: 0, updated: 0, skipped: 0, errors: [] as { rowIndex: number; reason: string }[] };
  const companyCache = new Map<string, string>();
  const ownerCache = new Map<string, string | null>();
  const tagCache = new Map<string, string>();

  for (const row of rows) {
    if (row.action === "skip") {
      result.skipped++;
      continue;
    }

    try {
      const fields: Record<string, string> = {};
      let companyName: string | null = null;
      let ownerEmail: string | null = null;
      let tagNames: string[] = [];

      for (const [header, target] of Object.entries(mapping)) {
        const value = row.values[header]?.trim();
        if (!value) continue;
        if (target === "company_name") companyName = value;
        else if (target === "owner_email") ownerEmail = value;
        else if (target === "tag_names") tagNames = value.split(/[,;]/).map((v) => v.trim()).filter(Boolean);
        else if (target !== "skip") fields[target] = value;
      }

      if (!fields.first_name && !fields.last_name && !fields.email) {
        result.errors.push({ rowIndex: row.rowIndex, reason: "Missing name and email" });
        continue;
      }

      let companyId: string | null = null;
      if (companyName) {
        const cacheKey = companyName.toLowerCase();
        if (companyCache.has(cacheKey)) {
          companyId = companyCache.get(cacheKey)!;
        } else {
          const { data: existing } = await supabase
            .from("companies")
            .select("id")
            .eq("organization_id", appUser.organization_id!)
            .ilike("name", companyName)
            .maybeSingle();
          if (existing) {
            companyId = existing.id;
          } else {
            const { data: created, error: companyError } = await supabase
              .from("companies")
              .insert({ organization_id: appUser.organization_id!, name: companyName })
              .select("id")
              .single();
            if (companyError) throw companyError;
            companyId = created.id;
          }
          companyCache.set(cacheKey, companyId);
        }
      }

      let ownerId: string | null = null;
      if (ownerEmail) {
        const cacheKey = ownerEmail.toLowerCase();
        if (ownerCache.has(cacheKey)) {
          ownerId = ownerCache.get(cacheKey) ?? null;
        } else {
          const { data: ownerUser } = await supabase
            .from("users")
            .select("id")
            .eq("organization_id", appUser.organization_id!)
            .ilike("email", ownerEmail)
            .maybeSingle();
          ownerId = ownerUser?.id ?? null;
          ownerCache.set(cacheKey, ownerId);
        }
      }

      const contactPayload: ContactInsert = {
        organization_id: appUser.organization_id!,
        first_name: fields.first_name ?? null,
        last_name: fields.last_name ?? null,
        email: fields.email ?? null,
        phone: fields.phone ?? null,
        job_title: fields.job_title ?? null,
        source: fields.source ?? null,
        company_id: companyId,
        owner_id: ownerId ?? appUser.id,
      };
      if (fields.lifecycle_stage) contactPayload.lifecycle_stage = fields.lifecycle_stage;

      let contactId: string;
      if (row.action === "update" && row.existingContactId) {
        const { error } = await supabase.from("contacts").update(contactPayload).eq("id", row.existingContactId);
        if (error) throw error;
        contactId = row.existingContactId;
        result.updated++;
      } else {
        const { data, error } = await supabase.from("contacts").insert(contactPayload).select("id").single();
        if (error) throw error;
        contactId = data.id;
        result.created++;
      }

      for (const tagName of tagNames) {
        const cacheKey = tagName.toLowerCase();
        let tagId = tagCache.get(cacheKey);
        if (!tagId) {
          const { data: existingTag } = await supabase
            .from("tags")
            .select("id")
            .eq("organization_id", appUser.organization_id!)
            .ilike("name", tagName)
            .maybeSingle();
          if (existingTag) {
            tagId = existingTag.id;
          } else {
            const { data: newTag, error: tagError } = await supabase
              .from("tags")
              .insert({ organization_id: appUser.organization_id!, name: tagName })
              .select("id")
              .single();
            if (tagError) throw tagError;
            tagId = newTag.id;
          }
          tagCache.set(cacheKey, tagId);
        }
        await supabase
          .from("contact_tags")
          .upsert({ contact_id: contactId, tag_id: tagId, organization_id: appUser.organization_id! }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
      }
    } catch (err) {
      result.errors.push({ rowIndex: row.rowIndex, reason: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  revalidatePath("/contacts");
  return result;
}
