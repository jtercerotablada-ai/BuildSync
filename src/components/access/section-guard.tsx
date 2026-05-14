"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { useEffectiveAccess } from "@/hooks/use-effective-access";
import {
  canAccessSection,
  FORBIDDEN_REDIRECT,
  type AppSection,
} from "@/lib/access-control";

/**
 * SectionGuard — wrap a page (or section of a page) to enforce
 * access-control client-side. When the resolved EffectiveAccess
 * indicates the user can't see this section, we redirect them
 * to /home (the canonical forbidden landing).
 *
 * Behavior:
 *   • While access is loading → show a centered spinner so the
 *     page doesn't flash content the user shouldn't see.
 *   • Access denied → fire a router.replace() so the back button
 *     doesn't take them back to the forbidden URL.
 *   • Access granted → render children.
 *
 * Use this alongside server-side gating where possible (server
 * gates protect against curl / server-rendered leaks; this gate
 * is the UX layer for client pages).
 */
export function SectionGuard({
  section,
  children,
}: {
  section: AppSection;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { access, loading, error } = useEffectiveAccess();

  const allowed = !loading && access && canAccessSection(access, section);
  const denied =
    !loading &&
    !error &&
    access !== null &&
    !canAccessSection(access, section);

  useEffect(() => {
    if (denied) {
      router.replace(FORBIDDEN_REDIRECT);
    }
  }, [denied, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px] bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error === "unauthorized") {
    if (typeof window !== "undefined") {
      window.location.href = `/login?callbackUrl=${encodeURIComponent(
        window.location.pathname
      )}`;
    }
    return null;
  }

  if (denied) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px] bg-white px-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 mx-auto flex items-center justify-center mb-3">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
          </div>
          <h2 className="text-base font-semibold text-slate-900 mb-1">
            Access restricted
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            You don't have permission to view this section. Redirecting to
            home…
          </p>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
