import Image from "next/image";

/**
 * Under-construction landing.
 *
 * While the proxy middleware is in maintenance mode (controlled by
 * MAINTENANCE_MODE — see src/proxy.ts), every request from the public
 * web lands here. Localhost / dev is unaffected because the flag only
 * trips when VERCEL_ENV is "production" or "preview".
 *
 * Plain server component — no client-side data, no analytics, no
 * outbound requests. The page is intentionally minimal so it costs
 * nothing to serve and gives nothing away while we iterate locally.
 */
export const dynamic = "force-static";

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-8">
        <div className="flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Image
            src="/ttc/img/logo-square.png"
            alt="TERCERO TABLADA CIVIL & STRUCTURAL ENG. INC."
            width={96}
            height={96}
            className="w-24 h-24 object-contain"
            priority
          />
        </div>

        <div className="space-y-3">
          <h1 className="text-[22px] font-semibold text-gray-900 tracking-tight">
            We&apos;ll be back shortly
          </h1>
          <p className="text-[14px] text-gray-600 leading-relaxed">
            TERCERO TABLADA CIVIL &amp; STRUCTURAL ENG. INC. is offline for
            scheduled maintenance. Please check back soon.
          </p>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <p className="text-[12px] text-gray-500">
            For urgent inquiries:{" "}
            <a
              href="mailto:juantercero766@gmail.com"
              className="text-gray-700 underline hover:text-black"
            >
              juantercero766@gmail.com
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
