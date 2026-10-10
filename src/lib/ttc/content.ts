import { en, type SiteContent } from './site';
import { es } from './site.es';
import type { Lang } from './i18n';

const bundles: Record<Lang, SiteContent> = { en, es };

/** The whole site's copy for one language. Structure is identical in both. */
export function getContent(lang: Lang): SiteContent {
  return bundles[lang];
}

/**
 * The label of a page in the main navigation, by its address.
 *
 * The views print it as their breadcrumb and eyebrow, so a page is called
 * the same thing in the menu and on itself. They used to read the list BY
 * POSITION (`primaryNav[3]`), which made its order untouchable; by address
 * the order is the header's alone. A page that is not in the list is a
 * mistake in the code, not something to render around.
 */
export function navLabelOf(c: SiteContent, href: string): string {
  const item = c.primaryNav.find((i) => i.href === href);
  if (!item) throw new Error(`navLabelOf: ${href} is not in primaryNav`);
  return item.label;
}

export type { SiteContent };
