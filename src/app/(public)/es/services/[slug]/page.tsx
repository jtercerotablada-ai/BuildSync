import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContent } from '@/lib/ttc/content';
import { services } from '@/lib/ttc/site';
import { pageMeta } from '@/components/ttc/views/meta';
import { ServiceDetailView } from '@/components/ttc/views/ServiceDetailView';
import { notFoundMetadata } from '@/components/ttc/views/NotFoundView';

const LANG = 'es' as const;

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return services.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = getContent(LANG).services.find((s) => s.slug === slug);
  // Normally unreachable: the proxy rewrites an unknown slug to the public
  // 404 page before routing (publicNotFoundTarget in src/proxy.ts). If it
  // ever gets here, Page() below throws notFound() into the public boundary.
  // The server HTML of that render takes its <head> from the BOUNDARY's
  // metadata export (Next never reads the throwing page's); this branch is
  // what the client applies after hydration, so the two must agree.
  if (!service) return notFoundMetadata(LANG);
  return pageMeta(LANG, `/services/${service.slug}`, {
    title: service.seo.title,
    description: service.seo.description,
    keywords: [...service.seo.keywords],
  });
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  // Fallback only — see generateMetadata above.
  if (!services.some((s) => s.slug === slug)) notFound();
  return <ServiceDetailView lang={LANG} slug={slug} />;
}
