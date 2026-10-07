import React from 'react';

/**
 * Everything under /es is Spanish. The document says so itself now: the
 * Spanish site has its own root layout, src/app/(public-es)/layout.tsx, which
 * prints <html lang="es"> in the server HTML.
 *
 * This wrapper predates that — the root <html> used to be lang="en" for the
 * whole app, and this was the only thing marking the page body as Spanish
 * before JavaScript ran. It is redundant under a Spanish root and is kept so
 * the markup of the pages is unchanged.
 *
 * It covers the page content only. The chrome (skip link, header, mobile menu,
 * footer) renders outside it, in PublicShell, and carries its own `lang` —
 * see SiteHeader and SiteFooter.
 */
export default function EsLayout({ children }: { children: React.ReactNode }) {
  return <div lang="es">{children}</div>;
}
