import type { Metadata } from 'next';
import { pageMeta } from '@/components/ttc/views/meta';
import { SEO } from '@/components/ttc/views/seo';
import { ContactView } from '@/components/ttc/views/ContactView';

const LANG = 'es' as const;

export const metadata: Metadata = pageMeta(LANG, '/contact', SEO[LANG].contact);

/** `?service=<shortTitle>` preselects the dropdown (linked from service pages). */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { service } = await searchParams;
  return <ContactView lang={LANG} presetService={service} />;
}
