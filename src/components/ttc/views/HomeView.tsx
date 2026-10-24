import React from 'react';
import type { Lang } from '@/lib/ttc/i18n';
import { Ribbon } from '@/components/ttc/mp/Ribbon';
import {
  FirmBand,
  FirmContact,
  FirmCredentials,
  FirmHero,
  FirmIntro,
  FirmStatement,
  FirmWork,
} from '@/components/ttc/mp/FirmHome';
import { FirmFx } from '@/components/ttc/mp/FirmFx';
import { HomeAddress } from './meta';

/**
 * Home, laid out after emxse.com (the owner, 2026-10-23: "el home de él está
 * mejor, cópialo al 100%"): their sections in their order, our words and
 * photographs. `home` in site.ts lists them and their rules.
 *
 *   FirmHero         full-screen video and "Get in touch"
 *   FirmIntro        the H1 left, the lede and the two notice links right
 *   Ribbon           "Our Services", two moving rows
 *   FirmWork         a featured service, three staggered service cards
 *   FirmStatement    one sentence, white then grey, and a square photograph
 *   FirmBand         a full-width black-and-white photograph
 *   FirmCredentials  the licenses, named, and the two-firm sentence
 *   FirmContact      "Get in touch." and the form (#contact)
 *
 * What the 2026-10-20 home carried — the two county columns, the fixed-fee
 * table, the offices we file with, new buildings and the partner cards —
 * lives on /existing-buildings, the service pages, the cost page and /about.
 *
 * Before the sections: HomeAddress, which draws nothing. It is the page's
 * canonical, hreflang and og:url, printed here because Next's metadata
 * cannot print the home page's address with its trailing slash (meta.tsx).
 */
export function HomeView({ lang }: { lang: Lang }) {
  return (
    <>
      <HomeAddress lang={lang} />
      <FirmHero />
      <FirmIntro />
      <Ribbon lang={lang} />
      <FirmWork />
      <FirmStatement />
      <FirmBand />
      <FirmCredentials />
      <FirmContact />
      <FirmFx />
    </>
  );
}
