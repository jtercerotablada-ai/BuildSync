import type { Metadata } from "next";
import { siteIcons } from "@/components/layout/site-icons";

/* Root layout of the ENGLISH public site: the document itself and nothing
   else. Its Spanish twin is src/app/(public-es)/layout.tsx, identical but for
   the language — which is the whole reason there are two (see the note in
   src/app/(app)/layout.tsx).

   Bare on purpose. The site's fonts, stylesheet, structured data and chrome
   are one level down, in (site)/layout.tsx, so that the error boundary beside
   this file (error.tsx) sits ABOVE them: a page that throws is replaced whole,
   chrome included, exactly as it was under the single root layout. Putting
   the shell here would have left a crashed page inside the header and footer.

   Only the icons are declared: title, description and the rest come from
   (site)/layout.tsx, which every public page is under. */
export const metadata: Metadata = {
  icons: siteIcons,
};

export default function PublicRootLayout({
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
