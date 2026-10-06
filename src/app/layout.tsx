import type { Metadata } from "next";

/* Deliberately bare. The public site (mp.css) and the authenticated app
   (globals.css, Inter, session/query/AI providers, toaster) share only this
   file, so anything imported here ships on both. The app's stylesheet and
   providers live in SaasShell (src/components/layout/saas-shell.tsx), which
   each SaaS layout wraps its tree in; the public layout brings its own. */

export const metadata: Metadata = {
  title: "TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. | Project Management",
  description: "TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. — Project Management Platform",
  // One icon set for BOTH hosts, all cut from the real TT monogram (never
  // redrawn). Everything lives under /ttc/ or at /favicon.ico, which the host
  // split serves in place on either host.
  //   - SVG first for modern browsers, a 48px PNG (Google's search favicon
  //     minimum) and a 192px PNG for Android home-screen shortcuts.
  //   - /favicon.ico (16/32/48) for legacy agents that request it blindly.
  //   - A 180px OPAQUE PNG for iOS, which ignores SVG touch icons and would
  //     otherwise screenshot the page for the home-screen tile.
  icons: {
    icon: [
      { url: "/ttc/img/logo-icon-favicon.svg", type: "image/svg+xml" },
      { url: "/ttc/icons/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/ttc/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/ttc/icons/apple-touch-icon.png", sizes: "180x180" },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
