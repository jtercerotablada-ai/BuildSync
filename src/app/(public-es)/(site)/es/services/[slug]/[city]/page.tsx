import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cityPath } from '@/lib/ttc/cities';
import { findCityPage } from '@/lib/ttc/city-content';
import { citySlugs } from '@/lib/ttc/city-slugs';
import { citySeo } from '@/lib/ttc/city-seo';
import { pageMeta } from '@/components/ttc/views/meta';
import { CityView } from '@/components/ttc/views/CityView';
import { notFoundMetadata } from '@/components/ttc/views/NotFoundView';

/**
 * The Spanish twin of services/[slug]/[city]: /es/services/<program>/<city>.
 * Same slugs as the English pages (cities.es.ts mirrors cities.en.ts row for
 * row), so the static params come from the one list.
 *
 * An address that is not on it is rewritten to the Spanish 404 by the proxy
 * before routing; anything deeper falls to `es/[...rest]`.
 */
const LANG = 'es' as const;

type Params = { slug: string; city: string };

export function generateStaticParams(): Params[] {
  return citySlugs.map((c) => ({ slug: c.program, city: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug, city } = await params;
  const page = findCityPage(LANG, slug, city);
  if (!page) return notFoundMetadata(LANG);
  return pageMeta(LANG, cityPath(page), citySeo(LANG, page));
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug, city } = await params;
  if (!findCityPage(LANG, slug, city)) notFound();
  return <CityView lang={LANG} program={slug} slug={city} />;
}
