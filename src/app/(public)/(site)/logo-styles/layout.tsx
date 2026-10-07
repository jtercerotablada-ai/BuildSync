import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

/**
 * Internal brand-asset reference page. Kept for the team, kept out of search —
 * it is not public-facing content. Also disallowed in robots.ts.
 */
export const metadata: Metadata = {
  title: 'Logo reference',
  robots: { index: false, follow: false, nocache: true },
};

/* The monogram studies are drawn in Inter by family name ('Inter'), which
   used to resolve only because the root layout loaded Inter for the app.
   The root is bare now, so this page loads it itself; next/font registers
   the face under that same name. Only the variable class is applied — it
   pulls in the @font-face without changing what the page inherits. */
const inter = Inter({
  subsets: ['latin'],
  variable: '--logo-font-inter',
  display: 'swap',
});

export default function LogoStylesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={inter.variable} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
