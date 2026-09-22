import Link from "next/link";
import {
  FallbackScreen,
  fallbackButton,
} from "@/components/layout/fallback-screen";

/* Renders under the bare root layout, for public and app URLs alike, so it
   styles itself instead of relying on globals.css (see FallbackScreen). */
export default function NotFound() {
  return (
    <FallbackScreen
      title="Page not found"
      text={
        <>
          This page doesn&apos;t exist, or the item it pointed to was deleted
          or is no longer shared with you.
        </>
      }
    >
      {/* No prefetch: on a public 404 it would pull the whole app's CSS and
          JS in the background for a link few visitors follow. */}
      <Link href="/home" prefetch={false} className={fallbackButton}>
        Back to home
      </Link>
    </FallbackScreen>
  );
}
