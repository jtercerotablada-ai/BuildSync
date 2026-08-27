import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import "leaflet/dist/leaflet.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // LanguageProvider used to wrap this tree because the calculators under
  // /knowledge/calculators/* called useTranslation. Those pages are gone
  // (calculators are not a SaaS surface), and nothing else under (dashboard)
  // uses the i18n hooks — the product UI is English-only. Dropping it also
  // removes one of the duplicate GET /api/users/preferences requests that
  // fired on every dashboard page load.
  return <DashboardShell>{children}</DashboardShell>;
}
