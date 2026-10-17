import type { Guide, GuideLabels, GuidesIndex } from './guides';
import * as en from './guides.en';
import * as es from './guides.es';
import type { Lang } from './i18n';

/* SERVER SIDE ONLY: the one door to the guides' text (see the header of
   guides.ts). A 'use client' file that imports it, or anything that imports
   it, puts all of that text in the browser's script; guides.test.ts walks
   the imports to make sure none does. */

const bundles: Record<Lang, { labels: GuideLabels; index: GuidesIndex; guides: readonly Guide[] }> = { en, es };

/** Every guide, in one language, in the order of `guideSlugs`. */
export function getGuides(lang: Lang): readonly Guide[] {
  return bundles[lang].guides;
}

/** One guide, or undefined when there is none under that slug. */
export function findGuide(lang: Lang, slug: string): Guide | undefined {
  return bundles[lang].guides.find((g) => g.slug === slug);
}

export function guideLabels(lang: Lang): GuideLabels {
  return bundles[lang].labels;
}

export function guidesIndex(lang: Lang): GuidesIndex {
  return bundles[lang].index;
}
