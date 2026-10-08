import React from 'react';
import { ADS, adsBootScript } from '@/lib/ttc/ads';

/**
 * Google Ads conversion measurement, as the public shell prints it: one
 * inline script when it is configured, and NOTHING when it is not — no
 * element, no attribute, no comment.
 *
 * The script itself, who it loads Google's tag for (ad clicks only) and what
 * it tells that tag are in `@/lib/ttc/ads`. Read that file first.
 *
 * Mounted by PublicShell and by nothing else. It must never be imported by a
 * root layout, by SaasShell or by anything under src/app/(app): the staff
 * application does not carry it (ads.test.ts keeps the list of importers).
 *
 * A server component, so the script is in the HTML the server sends and runs
 * as the page is parsed: it does not wait for React, and it runs once per
 * document — moving between pages of the site does not render it again.
 */
export function AdsTag() {
  if (!ADS.on) return null;
  return <script dangerouslySetInnerHTML={{ __html: adsBootScript(ADS) }} />;
}
