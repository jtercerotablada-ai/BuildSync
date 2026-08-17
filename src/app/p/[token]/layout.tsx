import type { Metadata } from "next";

/**
 * Bare layout for the password-less client link.
 *
 * No sidebar, no tab strip, no app chrome — this is the face the firm shows a
 * building owner, and the owner has no account to navigate with. The root
 * layout still supplies <html>, the font and the providers.
 */
export const metadata: Metadata = {
  title: "Project status | Tercero Tablada Civil & Structural Engineering Inc.",
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
  return <div className="min-h-screen bg-[#f7f6f3]">{children}</div>;
}
