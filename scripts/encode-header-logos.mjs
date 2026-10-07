#!/usr/bin/env node
/**
 * The two header marks, re-encoded for the slot they are drawn in.
 *
 *   public/ttc/img/logo-square.png  →  logo-square@144.webp  (dark mark, paper header)
 *   public/ttc/img/logo-white.png   →  logo-white@144.webp   (white mark, dark hero)
 *
 * Usage: node scripts/encode-header-logos.mjs
 *
 * A straight Lanczos resize of the 1254px master, stored as LOSSLESS WebP:
 * nothing is redrawn, recoloured or approximated — every pixel is the
 * master's own, which is the rule for this logo (docs/IMAGE-CREDITS.md).
 * Lossy WebP would be ~40% smaller again and is not worth a single altered
 * edge on the firm's mark.
 *
 * Why 144px: the header draws the mark 32–54 CSS px tall (mp.css,
 * `.mp-header__lockup`), so 144 covers a 3x phone (36 → 108, 44 → 132) and a
 * 2x large display (54 → 108). The header used to load the 256px PNGs — 32 kB
 * and 21 kB, both preloaded — for that slot.
 *
 * The PNGs stay: the 256px ones for the partner block, the engineer plate and
 * the app's fallback screen, the masters for JSON-LD, the app and e-mail.
 *
 * `sharp` is not listed in package.json; it is installed with Next. If the
 * size changes, update company.logo.markXsSize in src/lib/ttc/site.ts AND
 * site.es.ts.
 */
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SIZE = 144;
const IMG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'ttc', 'img');

for (const name of ['logo-square', 'logo-white']) {
  const out = path.join(IMG, `${name}@${SIZE}.webp`);
  await sharp(path.join(IMG, `${name}.png`))
    .resize(SIZE, SIZE, { kernel: 'lanczos3' })
    .webp({ lossless: true, effort: 6 })
    .toFile(out);
  const [was, now] = await Promise.all([stat(path.join(IMG, `${name}@256.png`)), stat(out)]);
  console.log(`${name}@${SIZE}.webp  ${now.size} B  (the 256px PNG is ${was.size} B)`);
}
