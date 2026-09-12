import { en, type SiteContent } from './site';
import { es } from './site.es';
import type { Lang } from './i18n';

const bundles: Record<Lang, SiteContent> = { en, es };

/** The whole site's copy for one language. Structure is identical in both. */
export function getContent(lang: Lang): SiteContent {
  return bundles[lang];
}

export type { SiteContent };
