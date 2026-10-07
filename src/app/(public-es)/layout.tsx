import type { Metadata } from "next";
import { siteIcons } from "@/components/layout/site-icons";

/* Root layout of the SPANISH public site, and the reason the public site has
   two roots: this is what makes the server HTML of every /es page begin
   <html lang="es">.

   Under one shared root layout the attribute was "en" for the whole app, and
   the Spanish pages corrected it in a client effect (LangHtml) — after
   hydration, which a crawler reading the HTML never sees. An SEO check read
   it as 16 pages whose markup contradicts their own hreflang. A root layout
   cannot choose the language per request without reading the request, which
   would have turned every prerendered page dynamic; a second root layout
   costs nothing at build time.

   Everything else matches src/app/(public)/layout.tsx on purpose — bare, with
   the shell one level down in (site)/layout.tsx and the error boundary beside
   this file above it. Keep the two in step. */
export const metadata: Metadata = {
  icons: siteIcons,
};

export default function PublicEsRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
