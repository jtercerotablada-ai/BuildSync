import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import "./portal.css";

/**
 * Bare layout for the password-less client link.
 *
 * No sidebar into the authenticated app, no tab strip — the chrome this page
 * DOES have (an in-page section sidebar + top bar) is the client's own, and
 * lives in the page component. The root layout still supplies <html>, the base
 * font and the providers; here we add the editorial display serif and the
 * `.portal` design-token scope.
 *
 * Instrument Serif is loaded via next/font (self-hosted, display:swap, one
 * weight) so the architectural title has no FOUC and no external request. It is
 * the same face the firm's marketing site already uses — gold-adjacent and
 * editorial — and it is exposed only as `--font-display`, used for the project
 * title, the big progress numeral and the calendar day.
 */
const displaySerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal"],
  variable: "--font-display",
  display: "swap",
});

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
  return (
    <div className={`portal ${displaySerif.variable} min-h-screen`}>{children}</div>
  );
}
