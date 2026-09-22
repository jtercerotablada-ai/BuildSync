import { SaasShell } from "@/components/layout/saas-shell";

/* No "already signed in → /home" redirect here. This layout wraps the
   token-bearing pages too (reset-password, verify-email), and a blanket
   redirect made a reset link unusable in any browser where someone was signed
   in. The login page sends an authenticated visitor on by itself. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SaasShell>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md p-8">
          {children}
        </div>
      </div>
    </SaasShell>
  );
}
