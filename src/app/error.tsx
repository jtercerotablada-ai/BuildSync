"use client";

import { startTransition, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FallbackScreen,
  fallbackButton,
  fallbackButtonOutline,
} from "@/components/layout/fallback-screen";

/* Renders under the bare root layout, so it styles itself instead of relying
   on globals.css or the shadcn Button (see FallbackScreen). */
export default function Error({
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

  /* reset() alone only clears the boundary and re-renders the SAME payload,
     so a server-component failure (a database timeout, a cold start) just
     came straight back. Refetch from the server first, in one transition with
     the reset, so "Try again" actually retries. */
  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <FallbackScreen
      title="Something went wrong"
      text="This screen failed to load. Try again — if it keeps happening, go back home and reopen it from there."
      reference={error.digest}
    >
      <button type="button" onClick={retry} className={fallbackButton}>
        Try again
      </button>
      <Link href="/home" prefetch={false} className={fallbackButtonOutline}>
        Back to home
      </Link>
    </FallbackScreen>
  );
}
