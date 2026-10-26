import type { Metadata } from "next";

/* One icon set for BOTH hosts, all cut from the real TT monogram (never
   redrawn). Everything lives under /ttc/ or at /favicon.ico, which the host
   split serves in place on either host.

   The owner, 2026-10-26: the mark in BLACK and gold on a transparent ground
   (no black square) — "lo blanco en negro y dorado y quitar el fondo negro".
   So every raster is cut from public/ttc/img/logo-square.png (black + gold,
   transparent), and the SVG favicon carries both marks: the black one by
   default, the white one (logo-white@256.png) under `prefers-color-scheme:
   dark`, because a black mark vanishes on a dark tab strip (Chrome, Edge and
   Firefox honour the media query inside an SVG favicon; Safari takes the PNG).
   Made by scratchpad/pw/fav/make.mjs (sharp; the ICO is PNG-in-ICO, 16/32/48).
   The `?v=2` on each URL: /ttc/* is served with max-age of 30 days, and
   browsers hold favicons longer still; a new query is a new file to them, so
   returning visitors see the black mark now. Bump it whenever the icons
   change. (/favicon.ico is must-revalidate and needs none.)
     - SVG first for modern browsers, a 48px PNG (Google's search favicon
       minimum) and a 192px PNG for Android home-screen shortcuts.
     - /favicon.ico (16/32/48) for legacy agents that request it blindly.
     - A 180px OPAQUE PNG for iOS (white tile, the mark on it): iOS ignores
       SVG touch icons, paints transparency black, and would otherwise
       screenshot the page for the home-screen tile.

   It lives here, not in a layout, because there is no single root layout any
   more: the app, the English site and the Spanish site each render their own
   <html> (see src/app/(app)/layout.tsx), and metadata only flows down from a
   layout to its own subtree. Each of the three declares this same object. */
export const siteIcons: NonNullable<Metadata["icons"]> = {
  icon: [
    { url: "/ttc/img/logo-icon-favicon.svg?v=2", type: "image/svg+xml" },
    { url: "/ttc/icons/icon-48.png?v=2", sizes: "48x48", type: "image/png" },
    { url: "/ttc/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
  ],
  shortcut: "/favicon.ico",
  apple: { url: "/ttc/icons/apple-touch-icon.png?v=2", sizes: "180x180" },
};
