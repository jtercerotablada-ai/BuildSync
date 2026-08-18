import type { Metadata } from "next";
import "./portal.css";

/**
 * Bare layout for the password-less client link.
 *
 * No sidebar into the authenticated app — the chrome this page DOES have (the
 * client's own sidebar + top bar) lives in the page component. The root layout
 * supplies <html> and Inter (`--font-inter`); the portal is a product surface
 * and uses that one clean sans throughout — no display serif. `.portal` scopes
 * the design tokens so nothing here can restyle the authenticated app.
 */

export const metadata: Metadata = {
  title: "Client Portal | Tercero Tablada Civil & Structural Engineering Inc.",
  // The URL is the credential. Keeping it out of an index is not the security
  // boundary — resolveShareLink is — but a shared project has no business
  // showing up in a search result either.
  robots: { index: false, follow: false },
};

export default function ClientLinkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="portal min-h-screen">{children}</div>;
}
