import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { pageMeta } from '@/components/ttc/views/meta';
import { GuideView } from '@/components/ttc/views/GuideView';
import { notFoundMetadata } from '@/components/ttc/views/NotFoundView';
import { guidePath, guideSlugs } from '@/lib/ttc/guides';
import { findGuide } from '@/lib/ttc/guide-content';

/**
 * One guide: /guides/<slug> (src/lib/ttc/guides.ts). Static, one page per
 * slug. Any other address is rewritten to the public 404 by the proxy
 * before routing (its list is built from the same slugs).
 */
const LANG = 'en' as const;

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return guideSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const g = findGuide(LANG, slug);
  if (!g) return notFoundMetadata(LANG);
  return pageMeta(LANG, guidePath(slug), g.seo);
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  if (!findGuide(LANG, slug)) notFound();
  return <GuideView lang={LANG} slug={slug} />;
}
