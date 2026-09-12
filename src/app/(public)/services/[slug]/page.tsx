import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContent } from '@/lib/ttc/content';
import { services } from '@/lib/ttc/site';
import { pageMeta } from '@/components/ttc/views/meta';
import { ServiceDetailView } from '@/components/ttc/views/ServiceDetailView';

const LANG = 'en' as const;

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
  if (!service) return { title: 'Not found' };
  return pageMeta(LANG, `/services/${service.slug}`, {
    title: service.seo.title,
    description: service.seo.description,
    keywords: [...service.seo.keywords],
  });
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  if (!services.some((s) => s.slug === slug)) notFound();
  return <ServiceDetailView lang={LANG} slug={slug} />;
}
