import type { NextConfig } from "next";

/**
 * Baseline Content-Security-Policy. Deliberately limited to directives that
 * cannot break the app: a script-src/img-src policy needs per-request nonces
 * for Next's inline scripts and an image allowlist (avatars, pasted cover
 * urls), so that stays a separate change. These still close real holes:
 * no <base> hijack of relative urls, no plugin content.
 */
const baseCsp = ["base-uri 'self'", "object-src 'none'"];

const commonHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const securityHeaders = [
  ...commonHeaders,
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Content-Security-Policy",
    value: [...baseCsp, "frame-ancestors 'self'"].join("; "),
  },
];

/**
 * The public form page (/forms/<id>) is the one page meant to be framed by
 * other sites — the builder's "Embed on your site" snippet iframes it with
 * ?embed=1 onto the marketing site and clients' sites. SAMEORIGIN made every
 * such embed a blank "refused to connect" box. Only that exact path is
 * opened; its tracking and print sub-pages keep the app's framing rules.
 */
const embeddableFormHeaders = [
  ...commonHeaders,
  {
    key: "Content-Security-Policy",
    value: [...baseCsp, "frame-ancestors *"].join("; "),
  },
];

/**
 * The app host must never be indexed. Its /login and /register were showing
 * up in brand searches as "… | Project Management". This header on EVERY
 * response there is what removes them — robots.ts deliberately leaves the app
 * host crawlable so crawlers can fetch a page and see it.
 *
 * APP_HOST is read at BUILD time. That costs nothing: a Vercel env var only
 * reaches the next deployment anyway, and switching the split off is already
 * "delete APP_HOST + redeploy". Unset (local dev, previews, split off) → no
 * rule at all. `has.value` is a regex, hence the escaped dots.
 */
const APP_HOST = (process.env.APP_HOST ?? "").trim().toLowerCase();
const appHostNoindex = APP_HOST
  ? [
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: APP_HOST.replace(/\./g, "\\.") }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ]
  : [];

/**
 * Google Ads conversion measurement on the public site is switched by four
 * variables (src/lib/ttc/ads.ts — the one module that reads them, and the
 * place to read about them). They are FROZEN HERE, AT BUILD TIME, for every
 * bundle of the build: browser, server and proxy.
 *
 * Without this Next inlines a NEXT_PUBLIC_* variable only where it is set
 * when the build runs. Left unset, the server code keeps a live
 * `process.env` read — and /contact and the public 404 are rendered on
 * demand, so a server started with different variables than its build would
 * print the measurement script on those pages while the prerendered Privacy
 * page still said the site sets no cookies. With the values pinned (an unset
 * one as the empty string, which is "off"), the script and the Privacy text
 * always come from the same four values. Nothing else is done with them.
 */
const GOOGLE_ADS_VARS = [
  "NEXT_PUBLIC_GOOGLE_ADS_ID",
  "NEXT_PUBLIC_GOOGLE_ADS_LABEL_FORM",
  "NEXT_PUBLIC_GOOGLE_ADS_LABEL_CALL",
  "NEXT_PUBLIC_GOOGLE_ADS_LABEL_WHATSAPP",
] as const;
const googleAdsEnv = Object.fromEntries(
  GOOGLE_ADS_VARS.map((name) => [name, process.env[name] ?? ""]),
);

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // See GOOGLE_ADS_VARS above: build-time values, the same in every bundle.
  env: googleAdsEnv,

  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
  },

  // Security headers. Two disjoint sources, so the form page never also
  // receives X-Frame-Options (a header can be overridden here, not removed).
  async headers() {
    return [
      {
        source: "/((?!forms/[^/]+$).*)",
        headers: securityHeaders,
      },
      {
        source: "/forms/:formId",
        headers: embeddableFormHeaders,
      },
      // The public site's photos, video, logos and share cards. Served with
      // `max-age=0, must-revalidate` by default, so every page view re-asked
      // for 15–25 of them. 30 days, not `immutable`: the filenames are not
      // content-hashed, so a photo replaced IN PLACE needs a new filename (the
      // existing convention) or a ?v= to reach returning visitors sooner.
      {
        source: "/ttc/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, stale-while-revalidate=31536000",
          },
        ],
      },
      // Says the same as the Spanish pages' own <html lang="es">, which
      // their root layout (src/app/(public-es)/layout.tsx) prints in the
      // server HTML. The header came first, from when one root layout said
      // "en" for every page and the Spanish ones corrected it only after
      // hydration; it stays so the response and the document keep agreeing.
      {
        source: "/es/:path*",
        headers: [{ key: "Content-Language", value: "es" }],
      },
      ...appHostNoindex,
    ];
  },

  // Retired public URLs → their current twins, instead of a 404. 308: these
  // moves are final. They run BEFORE the proxy, so they work on either host
  // and no proxy rule (the host split's fail-closed 404, the public 404) can
  // shadow them. proxy.test.ts pins the /v2 pair and the renamed service.
  //
  // - The retired static site (github.com/jtercerotablada-ai/tercero-tablada-
  //   website) published exactly the five .html pages; old bookmarks and any
  //   still-indexed copies land on the current pages.
  // - /v2/* was the preview of the editorial redesign, which now lives at the
  //   root (/, /services, /about, /contact, /projects…). This rule used to be
  //   a block in proxy() AFTER the host split, so on the public host the
  //   split's fail-closed 404 rewrite answered first and /v2/about 404'd
  //   instead of 308ing to /about. Bare /v2 has its own entry so it goes to
  //   the home page rather than depending on how `:path*` treats zero
  //   segments.
  // - /services/building-safety-inspections was renamed to
  //   /services/milestone-inspections when Broward's Building Safety
  //   Inspection Program got its own page (/services/broward-bsip): the old
  //   slug was one word away from the program's name and would have competed
  //   with it. Exact paths, one per language — the Spanish page lives under
  //   /es and a redirect must not change the visitor's language. Without
  //   these the proxy would answer the old URL with the public 404 (it is no
  //   longer a slug in site.ts). proxy.test.ts pins both, and that every
  //   destination is a page that exists.
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/about.html", destination: "/about", permanent: true },
      { source: "/services.html", destination: "/services", permanent: true },
      { source: "/projects.html", destination: "/projects", permanent: true },
      { source: "/contact.html", destination: "/contact", permanent: true },
      { source: "/v2", destination: "/", permanent: true },
      { source: "/v2/:path*", destination: "/:path*", permanent: true },
      {
        source: "/services/building-safety-inspections",
        destination: "/services/milestone-inspections",
        permanent: true,
      },
      {
        source: "/es/services/building-safety-inspections",
        destination: "/es/services/milestone-inspections",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
