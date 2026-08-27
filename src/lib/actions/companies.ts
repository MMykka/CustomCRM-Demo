"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth";

export async function addCompany(input: { name: string; domain: string }) {
  if (!input.name.trim()) return null;

  const appUser = await requireAppUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("companies")
    .insert({
      organization_id: appUser.organization_id!,
      name: input.name.trim(),
      domain: input.domain.trim() || null,
      owner_id: appUser.id,
    })
    .select("id")
    .single();

  if (error) throw error;

  revalidatePath("/companies");
  return data.id as string;
}

export async function updateCompany(
  companyId: string,
  input: {
    name: string;
    domain: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    ownerId: string | null;
  },
) {
  await requireAppUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("companies")
    .update({
      name: input.name.trim(),
      domain: input.domain.trim() || null,
      phone: input.phone.trim() || null,
      address: input.address.trim() || null,
      city: input.city.trim() || null,
      state: input.state.trim() || null,
      postal_code: input.postalCode.trim() || null,
      country: input.country.trim() || null,
      owner_id: input.ownerId,
    })
    .eq("id", companyId);

  if (error) throw error;

  revalidatePath(`/companies/${companyId}`);
  revalidatePath("/companies");
}

// Links every contact that has no company yet to an existing company
// whose domain matches the contact's email domain. Never creates a new
// company -- only links to ones that already exist.
export async function autoLinkContactsByDomain() {
  const appUser = await requireAppUser();
  const supabase = await createClient();

  const [{ data: companies }, { data: contacts }] = await Promise.all([
    supabase.from("companies").select("id, domain").eq("organization_id", appUser.organization_id!).not("domain", "is", null),
    supabase.from("contacts").select("id, email").eq("organization_id", appUser.organization_id!).is("company_id", null).not("email", "is", null),
  ]);

  const domainToCompanyId = new Map<string, string>();
  for (const c of companies ?? []) {
    if (c.domain) domainToCompanyId.set(c.domain.toLowerCase(), c.id);
  }

  const contactIdsByCompany = new Map<string, string[]>();
  for (const contact of contacts ?? []) {
    const domain = contact.email?.split("@")[1]?.trim().toLowerCase();
    if (!domain) continue;
    const companyId = domainToCompanyId.get(domain);
    if (!companyId) continue;
    const list = contactIdsByCompany.get(companyId) ?? [];
    list.push(contact.id);
    contactIdsByCompany.set(companyId, list);
  }

  let linked = 0;
  for (const [companyId, contactIds] of contactIdsByCompany) {
    const { error } = await supabase.from("contacts").update({ company_id: companyId }).in("id", contactIds);
    if (error) throw error;
    linked += contactIds.length;
  }

  revalidatePath("/contacts");
  revalidatePath("/companies");
  return { linked };
}
