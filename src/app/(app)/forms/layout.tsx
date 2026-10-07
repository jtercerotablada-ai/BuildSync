import { SaasShell } from "@/components/layout/saas-shell";

/* Outside every route group, so it brings the app's stylesheet and
   providers itself — the root layout is bare (see saas-shell.tsx). */
export default function FormsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SaasShell>{children}</SaasShell>;
}
