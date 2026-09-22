"use client";

import {
  SessionProvider as NextAuthSessionProvider,
  useSession,
} from "next-auth/react";
import type { Session } from "next-auth";
import { ReactNode, useEffect, useState } from "react";

interface Props {
  children: ReactNode;
}

/* SaasShell mounts this once per SaaS route group, and the groups are
   siblings, so a hop between them (login → /home, /teams/new → /teams/<id>,
   dashboard ↔ /portal) remounts it. next-auth clears its cache on unmount, so
   a cold provider fell back to "loading" and refetched: the avatar and name
   blanked and role-gated widgets briefly rendered for the wrong role. The
   last signed-in session this page saw seeds the new provider instead — the
   same continuity the single root provider had; it still refetches behind
   it. Browser-only and empty on a full load, so server render and hydration
   agree. A signed-out (null) session is never seeded: a brief
   "unauthenticated" could trigger redirects where "loading" is safe. */
let lastSession: Session | undefined;

function RememberSession() {
  const { data, status } = useSession();
  useEffect(() => {
    if (status === "authenticated") lastSession = data;
    else if (status === "unauthenticated") lastSession = undefined;
  }, [data, status]);
  return null;
}

export function SessionProvider({ children }: Props) {
  const [initialSession] = useState(() =>
    typeof window === "undefined" ? undefined : lastSession
  );

  return (
    <NextAuthSessionProvider session={initialSession}>
      <RememberSession />
      {children}
    </NextAuthSessionProvider>
  );
}
