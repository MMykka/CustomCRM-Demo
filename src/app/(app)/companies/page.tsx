import { createClient } from "@/lib/supabase/server";
import { CompaniesTable, type CompanyRow } from "@/components/companies/companies-table";

export default async function CompaniesPage() {
  const supabase = await createClient();

  const [{ data: companies, error }, { data: contacts }, { data: deals }] = await Promise.all([
    supabase.from("companies").select("*, owner:users(id, full_name, email)").order("created_at", { ascending: false }),
    supabase.from("contacts").select("id, company_id").not("company_id", "is", null),
    supabase.from("deals").select("company_id, contact_id, value, currency, status"),
  ]);

  if (error) throw error;

  const contactCompanyMap = new Map<string, string>();
  const contactCountByCompany = new Map<string, number>();
  for (const c of contacts ?? []) {
    if (!c.company_id) continue;
    contactCompanyMap.set(c.id, c.company_id);
    contactCountByCompany.set(c.company_id, (contactCountByCompany.get(c.company_id) ?? 0) + 1);
  }

  const openDealCountByCompany = new Map<string, number>();
  const openDealValueByCompany = new Map<string, number>();
  const revenueByCompany = new Map<string, number>();
  const currencyByCompany = new Map<string, string>();

  for (const deal of deals ?? []) {
    const companyId = deal.company_id ?? (deal.contact_id ? contactCompanyMap.get(deal.contact_id) : null);
    if (!companyId) continue;
    if (!currencyByCompany.has(companyId)) currencyByCompany.set(companyId, deal.currency);
    if (deal.status === "open") {
      openDealCountByCompany.set(companyId, (openDealCountByCompany.get(companyId) ?? 0) + 1);
      openDealValueByCompany.set(companyId, (openDealValueByCompany.get(companyId) ?? 0) + deal.value);
    } else if (deal.status === "won") {
      revenueByCompany.set(companyId, (revenueByCompany.get(companyId) ?? 0) + deal.value);
    }
  }

  const rows: CompanyRow[] = (companies ?? []).map((company) => ({
    ...company,
    contactCount: contactCountByCompany.get(company.id) ?? 0,
    openDealCount: openDealCountByCompany.get(company.id) ?? 0,
    openDealValue: openDealValueByCompany.get(company.id) ?? 0,
    totalRevenue: revenueByCompany.get(company.id) ?? 0,
    currency: currencyByCompany.get(company.id) ?? "USD",
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="text-sm text-muted-foreground">{rows.length} companies</p>
      </div>
      <CompaniesTable data={rows} />
    </div>
  );
}
