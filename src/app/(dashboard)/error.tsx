"use client";

import { startTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/* Segment boundary for the dashboard. Without it the root app/error.tsx was
   the only one, so any page failure replaced the whole shell (sidebar and top
   bar included). This one renders inside DashboardShell, so navigation stays
   usable while the failed page shows its error. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  /* reset() alone re-renders the same payload, so a server-component failure
     came straight back. Refetch first, in one transition with the reset. */
  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center space-y-4">
        <h1 className="text-lg font-semibold text-gray-900">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground">
          This page failed to load. Try again — if it keeps happening, go back
          home and reopen it from there.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/70">
            Reference: {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-2">
          <Button onClick={retry}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/home">Back to home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
