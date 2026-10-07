"use client";

/* The same screen the app shows, mounted directly under this root layout —
   above the site chrome in (site)/layout.tsx, so a page that throws is
   replaced whole. An error boundary only catches below the layout it sits
   beside, and with a root layout per group there is no shared place left to
   put a single one. */
export { default } from "@/app/(app)/error";
