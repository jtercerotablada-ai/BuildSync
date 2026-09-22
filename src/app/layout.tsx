import type { Metadata } from "next";

/* Deliberately bare. The public site (mp.css) and the authenticated app
   (globals.css, Inter, session/query/AI providers, toaster) share only this
   file, so anything imported here ships on both. The app's stylesheet and
   providers live in SaasShell (src/components/layout/saas-shell.tsx), which
   each SaaS layout wraps its tree in; the public layout brings its own. */

export const metadata: Metadata = {
  title: "TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. | Project Management",
  description: "TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC. — Project Management Platform",
  icons: {
    icon: "/ttc/img/logo-icon-favicon.svg",
    shortcut: "/ttc/img/logo-icon-favicon.svg",
    apple: "/ttc/img/logo-icon-favicon.svg",
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
