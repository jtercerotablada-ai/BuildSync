import type { Metadata } from 'next';
import { company, ui } from '@/lib/ttc/site';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { SectionHeading } from '@/components/ttc/mp/primitives';
import { OG_IMAGE } from '@/components/ttc/views/meta';

const TITLE = ui.footer.imageCredits;
const DESCRIPTION = 'How the photography and video on this site are licensed.';

export const metadata: Metadata = {
  // Not the full firm name: the (public) layout's title template appends it,
  // and a title carrying it twice is what search results actually render.
  title: TITLE,
  description: DESCRIPTION,
  // One page, English only — there is no /es/credits — so it declares only
  // its canonical, never an `es` hreflang pointing back at an English page.
  alternates: { canonical: '/credits' },
  // Thin by design: it exists to be reachable (the footer links it on every
  // page), not to rank. Kept out of the sitemap as well.
  robots: { index: false, follow: true },
  // A child `openGraph` REPLACES the layout's rather than merging with it, so
  // this one is complete on its own: url, site name and the share image.
  openGraph: {
    title: `${TITLE} · ${company.name}`,
    description: DESCRIPTION,
    url: '/credits',
    siteName: company.name,
    type: 'website',
    locale: 'en_US',
    images: [OG_IMAGE.en],
  },
};

/**
 * Where the site's photography and video come from, stated plainly.
 *
 * Every photograph and clip currently shown is licensed from Pexels or
 * through the firm's Artgrid subscription. Neither license requires
 * attribution, so the page lists no per-image rows. If a Creative Commons
 * image is ever used again, its credit belongs here: CC BY and CC BY-SA
 * require attribution "in a manner reasonable to the medium", which for a
 * website means a page a visitor can reach — not a file in the repository.
 *
 * Public copy only. No internal notes, file paths or provenance questions
 * belong on this page; that record lives with the media catalogue.
 */
export default function CreditsPage() {
  return (
    <>
      <PageHero
        eyebrow={ui.legalPages.legal}
        crumbs={[{ href: '/', label: ui.home }, { label: TITLE }]}
        titleLines={[TITLE]}
        sub={`The photography on this site is licensed stock, shown to illustrate building types — never as a portfolio. None of it depicts a project by ${company.name}`}
      />

      {/* Standard shell so the body shares the hero's left edge; the prose
          carries the reading measure. */}
      <section className="mp-section mp-surface--paper">
        <div className="mp-shell">
          <SectionHeading n="01" label="Licensing" />
          <div className="mp-prose mp-measure">
            <h2>Photography and video</h2>
            <p>
              The photographs and video on this site are licensed from Pexels
              and Artgrid; neither license requires attribution.
            </p>

            <h2>Software marks</h2>
            <p>
              Revit, Navisworks, Autodesk, CYPE, BCF and buildingSMART are
              trademarks of their respective owners. Their logos appear
              unmodified, apart from a display filter, only to identify the
              software used in our workflow.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
