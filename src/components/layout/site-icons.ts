import type { Metadata } from "next";

/* One icon set for BOTH hosts, all cut from the real TT monogram (never
   redrawn). Everything lives under /ttc/ or at /favicon.ico, which the host
   split serves in place on either host.
     - SVG first for modern browsers, a 48px PNG (Google's search favicon
       minimum) and a 192px PNG for Android home-screen shortcuts.
     - /favicon.ico (16/32/48) for legacy agents that request it blindly.
     - A 180px OPAQUE PNG for iOS, which ignores SVG touch icons and would
       otherwise screenshot the page for the home-screen tile.

   It lives here, not in a layout, because there is no single root layout any
   more: the app, the English site and the Spanish site each render their own
   <html> (see src/app/(app)/layout.tsx), and metadata only flows down from a
   layout to its own subtree. Each of the three declares this same object. */
export const siteIcons: NonNullable<Metadata["icons"]> = {
  icon: [
    { url: "/ttc/img/logo-icon-favicon.svg", type: "image/svg+xml" },
    { url: "/ttc/icons/icon-48.png", sizes: "48x48", type: "image/png" },
    { url: "/ttc/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  ],
  shortcut: "/favicon.ico",
  apple: { url: "/ttc/icons/apple-touch-icon.png", sizes: "180x180" },
};
