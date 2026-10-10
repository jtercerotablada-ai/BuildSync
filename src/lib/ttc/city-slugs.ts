/**
 * program/slug of every city page — the one list the proxy reads, so the
 * pages' text stays out of its bundle. cities.test.ts fails if this list and
 * cities.en.ts ever differ.
 */
export const citySlugs: readonly { program: string; slug: string }[] = [
  { program: 'building-recertification', slug: 'miami' },
  { program: 'building-recertification', slug: 'miami-beach' },
  { program: 'building-recertification', slug: 'hialeah' },
  { program: 'building-recertification', slug: 'coral-gables' },
  { program: 'building-recertification', slug: 'doral' },
  { program: 'building-recertification', slug: 'north-miami' },
  { program: 'building-recertification', slug: 'north-miami-beach' },
  { program: 'building-recertification', slug: 'aventura' },
  { program: 'building-recertification', slug: 'sunny-isles-beach' },
  { program: 'building-recertification', slug: 'miami-gardens' },
  { program: 'building-recertification', slug: 'homestead' },
  { program: 'building-recertification', slug: 'surfside' },
  { program: 'building-recertification', slug: 'key-biscayne' },
  { program: 'broward-bsip', slug: 'fort-lauderdale' },
  { program: 'broward-bsip', slug: 'hollywood' },
  { program: 'broward-bsip', slug: 'pompano-beach' },
  { program: 'broward-bsip', slug: 'hallandale-beach' },
  { program: 'broward-bsip', slug: 'deerfield-beach' },
  { program: 'broward-bsip', slug: 'pembroke-pines' },
  { program: 'broward-bsip', slug: 'miramar' },
  { program: 'broward-bsip', slug: 'plantation' },
  { program: 'broward-bsip', slug: 'sunrise' },
  { program: 'broward-bsip', slug: 'davie' },
];
