import React from 'react';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { LangHtml } from './lang';

/**
 * Header, main and footer. Both chrome components read the language from the
 * URL themselves, so one layout serves the English and the Spanish routes.
 *
 * <main> is the skip link's target, and `tabIndex={-1}` is what lets it take
 * focus: without it the browser scrolls to #main but the next Tab starts again
 * from the top of the header. -1 keeps it out of the Tab order; a programmatic
 * focus target draws no ring (mp.css). It is also what the open mobile menu
 * makes `inert`, together with the footer.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LangHtml />
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
