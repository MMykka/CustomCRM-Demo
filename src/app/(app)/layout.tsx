import { requireAppUser } from "@/lib/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const appUser = await requireAppUser();

  return (
    <div className="flex min-h-screen">
      <AppSidebar userName={appUser.full_name ?? appUser.email} userEmail={appUser.email} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
