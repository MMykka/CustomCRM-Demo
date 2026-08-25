import { createClient } from "@/lib/supabase/server";
import { CompaniesTable, type CompanyRow } from "@/components/companies/companies-table";

export default async function CompaniesPage() {
  const supabase = await createClient();

  const { data: companies, error } = await supabase
    .from("companies")
    .select("*, owner:users(id, full_name, email)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="text-sm text-muted-foreground">{companies?.length ?? 0} companies</p>
      </div>
      <CompaniesTable data={(companies ?? []) as CompanyRow[]} />
    </div>
  );
}
