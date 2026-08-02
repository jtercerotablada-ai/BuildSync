import type { Metadata } from 'next';

/**
 * Internal brand-asset reference page. Kept for the team, kept out of search —
 * it is not public-facing content. Also disallowed in robots.ts.
 */
export const metadata: Metadata = {
  title: 'Logo reference',
  robots: { index: false, follow: false, nocache: true },
};

export default function LogoStylesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
