import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LanguageProvider } from "@/components/ttc/language-provider";
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

  // LanguageProvider is required by every page that uses `useTranslation`
  // — most notably the calculators under /knowledge/calculators/*, which
  // share the i18n strings with the marketing site. Without it the page
  // crashes on first render ("This page couldn't load").
  return (
    <LanguageProvider>
      <DashboardShell>{children}</DashboardShell>
    </LanguageProvider>
  );
}
