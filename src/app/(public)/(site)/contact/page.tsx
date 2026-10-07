import type { Metadata } from 'next';
import { pageMeta } from '@/components/ttc/views/meta';
import { SEO } from '@/components/ttc/views/seo';
import { ContactView } from '@/components/ttc/views/ContactView';

const LANG = 'en' as const;

export const metadata: Metadata = pageMeta(LANG, '/contact', SEO[LANG].contact);

/**
 * `?service=<slug>` preselects the dropdown (service pages link with the
 * slug). ContactForm maps a slug, or an option label in either language
 * from an older link, to this language's option; anything else is ignored.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ service?: string | string[] }>;
}) {
  const { service } = await searchParams;
  // `?service=a&service=b` arrives as an array; the first value wins.
  const preset = Array.isArray(service) ? service[0] : service;
  return <ContactView lang={LANG} presetService={preset} />;
}
