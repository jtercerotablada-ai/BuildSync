import type { Metadata } from 'next';
import { company, contact, ui } from '@/lib/ttc/site';
import { marks } from '@/lib/ttc/municipalities';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { SectionHeading } from '@/components/ttc/mp/primitives';
import { OG_IMAGE } from '@/components/ttc/views/meta';

const TITLE = ui.footer.imageCredits;

/* Where each mark was taken from: the government's own website, fetched
   2026-10-16. The table is `marks` in municipalities.ts, so a mark added to
   the home page's "Jurisdictions" section is credited here by the same
   edit. */
const JURISDICTION_CREDITS = Object.entries(marks).map(([name, m]) => ({
  name,
  host: m.host,
  page: `https://www.${m.host}/`,
}));
const DESCRIPTION = 'How the photography and video on this site are licensed.';

export const metadata: Metadata = {
  // No firm name here: the (public) layout's title template appends the
  // short one, and a title carrying it twice is what search results render.
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

            <h2>Jurisdiction seals and logos</h2>
            <p>
              The marks shown on the home page under “Jurisdictions” belong to
              the governments they identify. Each was taken from that
              government’s own website, unaltered apart from cropping and
              format conversion, and is shown only to say which office a
              notice comes from. Tercero Tablada is an independent firm and is
              not affiliated with, endorsed by or acting for any of them.
            </p>
            <ul>
              {JURISDICTION_CREDITS.map((j) => (
                <li key={j.name}>
                  {j.name}: from{' '}
                  <a href={j.page} rel="noopener noreferrer">
                    {j.host}
                  </a>
                  .
                </li>
              ))}
            </ul>
            <p>
              Each government may update its mark at any time. To have one
              removed or replaced, write to {contact.email} and it
              will be changed.
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
