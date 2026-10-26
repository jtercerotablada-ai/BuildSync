import type { Metadata } from 'next';
import { company, contact, imagery, legal, ui } from '@/lib/ttc/site';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { LegalDoc } from '@/components/ttc/mp/LegalDoc';
import { OG_IMAGE } from '@/components/ttc/views/meta';

const TITLE = ui.footer.imageCredits;

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
    <div className="mp-plates mp-dark">
      <PageHero
        eyebrow={ui.legalPages.legal}
        crumbs={[{ href: '/', label: ui.home }, { label: TITLE }]}
        titleLines={[TITLE]}
        sub={`The photography on this site is licensed stock, shown to illustrate building types — never as a portfolio. None of it depicts a project by ${company.name}`}
        photo={imagery.pages.legal}
      />

      {/* The layout of the privacy policy and the terms (LegalDoc): contents
          on the left, numbered sections of justified text on the right. */}
      <LegalDoc
        label="Licensing"
        tocLabel={legal.toc}
        updated={legal.updated}
        sections={[
          {
            h: 'Photography and video',
            body: (
              <p>
                The photographs and video on this site are licensed from Pexels and Artgrid; neither
                license requires attribution. They show kinds of buildings and of work, and none of
                them shows a project of the firm.
              </p>
            ),
          },
          {
            h: 'Software names',
            body: (
              <p>
                Revit is a registered trademark or trademark of Autodesk, Inc., and/or its
                subsidiaries and/or affiliates in the USA and/or other countries. It is named only
                to say which software the project teams we work with use, as text and without any
                Autodesk logo. This firm is not affiliated with Autodesk, and Autodesk does not
                sponsor or approve it.
              </p>
            ),
          },
          {
            h: 'Trademarks and third parties',
            body: (
              <p>
                Every other name, logo and mark on this site belongs to its owner. Showing one does
                not mean that its owner sponsors, approves or is connected with this firm, and the
                firm’s own name and logo may not be used by others without permission.
              </p>
            ),
          },
          {
            h: 'Corrections and removals',
            body: (
              <p>
                If you own something shown here and believe it is credited wrongly, or should not
                be shown, write to <a href={`mailto:${contact.email}`}>{contact.email}</a> with
                the page and what you would like changed. We will review it and correct or remove
                it.
              </p>
            ),
          },
        ]}
      />
    </div>
  );
}
