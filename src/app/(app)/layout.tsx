import type { Metadata } from "next";
import { siteIcons } from "@/components/layout/site-icons";

/* The app's root layout — one of THREE. There is no src/app/layout.tsx: a
   single root layout can only print one <html lang>, and reading the request
   there to choose it would have made every page dynamic, so the Spanish pages
   left the server as lang="en". Each of these groups now renders its own
   document:

     (app)        this file — every staff route: (auth), (dashboard),
                  (fullpage), (portal), forms/, invite/, maintenance/ and
                  onboarding/. They share this one root ON PURPOSE: Next does
                  a full page load when a navigation crosses root layouts, and
                  moving between these must stay client-side.
     (public)     the English marketing site, lang="en".
     (public-es)  its Spanish mirror, lang="es".

   Crossing between the three is a full page load. That only ever happens on
   the language switch and on a link from the site into the app, which the
   host split already sends to another origin in production.

   Deliberately bare, as the single root was. The app's stylesheet and
   providers (globals.css, Inter, session/query/AI providers, toaster) live in
   SaasShell (src/components/layout/saas-shell.tsx), which each SaaS layout
   wraps its tree in, so the error and not-found screens beside this file
   render under nothing but <html><body>. */

export const metadata: Metadata = {
  title: "TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. | Project Management",
  description: "TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. — Project Management Platform",
  icons: siteIcons,
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
