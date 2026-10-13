"use client";

import { PublicError } from "@/components/layout/public-error";

/* The public site's own error screen, mounted directly under this root
   layout — above the site chrome in (site)/layout.tsx, so a page that throws
   is replaced whole. An error boundary only catches below the layout it sits
   beside, and with a root layout per group there is no shared place left to
   put a single one: the Spanish site mounts the same screen, in Spanish,
   from (public-es)/error.tsx. */
export default function Error(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PublicError lang="en" {...props} />;
}
