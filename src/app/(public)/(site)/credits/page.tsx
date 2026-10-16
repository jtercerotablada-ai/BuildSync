import type { Metadata } from 'next';
import { company, contact, legal, ui } from '@/lib/ttc/site';
import { marks } from '@/lib/ttc/municipalities';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { LegalDoc } from '@/components/ttc/mp/LegalDoc';
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
            h: 'Jurisdiction seals and logos',
            body: (
              <>
                <p>
                  The marks shown on the home page under “Jurisdictions” belong to the governments
                  they identify. Each was taken from that government’s own website and is shown
                  only to say which office a notice comes from. They are unaltered apart from
                  cropping, format conversion and, for the marks their governments publish only in
                  white, drawing them in dark ink so that they can be read. Tercero Tablada is an
                  independent firm: it is not affiliated with, endorsed by or acting for any of
                  them, and nothing on this site is an official publication of any of them.
                </p>
                <ul className="mp-legal__cols">
                  {JURISDICTION_CREDITS.map((j) => (
                    <li key={j.name}>
                      {j.name}:{' '}
                      <a href={j.page} rel="noopener noreferrer">
                        {j.host}
                      </a>
                    </li>
                  ))}
                </ul>
                <p>
                  Some governments do not allow their mark to be used by a private company, or allow
                  it only with permission; where a government’s own terms say so, its mark is not
                  shown and only its name is listed. Each government may also update its mark at any
                  time. To have a mark removed or replaced, write to{' '}
                  <a href={`mailto:${contact.email}`}>{contact.email}</a> and it will be changed.
                </p>
              </>
            ),
          },
          {
            h: 'Software marks',
            body: (
              <p>
                Revit, Navisworks, Autodesk, CYPE, BCF and buildingSMART are trademarks of their
                respective owners. Their logos appear unmodified, apart from a display filter, only
                to identify the software used in our workflow.
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
    </>
  );
}
