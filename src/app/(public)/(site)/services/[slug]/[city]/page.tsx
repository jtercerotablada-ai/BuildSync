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
 * One city under its county program: /services/<program>/<city>
 * (src/lib/ttc/cities.ts). Static, one page per entry of that list.
 *
 * An address that is not on the list never gets here: the proxy rewrites it
 * to the public 404 before routing (`publicNotFoundTarget`, src/proxy.ts —
 * its list is built from the same slugs). If that rule is ever bypassed,
 * Page() throws notFound() into the public boundary, as the service page
 * above it does.
 */
const LANG = 'en' as const;

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
