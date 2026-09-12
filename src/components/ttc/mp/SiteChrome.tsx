import React from 'react';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { LangHtml } from './lang';

/**
 * Header, main and footer. Both chrome components read the language from the
 * URL themselves, so one layout serves the English and the Spanish routes.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LangHtml />
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
