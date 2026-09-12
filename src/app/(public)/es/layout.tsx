import React from 'react';

/**
 * Everything under /es is Spanish, and this is the only place that can say so
 * on the SERVER.
 *
 * The root <html lang="en"> in src/app/layout.tsx is shared with the
 * authenticated app, and making it language-aware would mean reading headers()
 * there, which opts the entire site out of static rendering. `LangHtml` still
 * corrects the html attribute once JavaScript runs; this wrapper is what marks
 * the subtree for screen readers, translation tools and search engines when it
 * does not — the public layout ships a <noscript> path, so no-JS is supported.
 */
export default function EsLayout({ children }: { children: React.ReactNode }) {
  return <div lang="es">{children}</div>;
}
