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

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,

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
    ];
  },
};

export default nextConfig;
