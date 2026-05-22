/**
 * Maintenance landing — intentionally neutral.
 *
 * No logo, no contact info, no mention of the company or the product.
 * Reads like a generic "this site doesn't exist" page so the public
 * web has nothing to crawl or fingerprint while we iterate on
 * localhost. The proxy middleware redirects every Vercel-hosted
 * request here (see src/proxy.ts → MAINTENANCE_MODE).
 */
export const dynamic = "force-static";

export const metadata = {
  title: "Not Found",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-[20px] font-normal text-gray-900">
          This site does not exist.
        </h1>
      </div>
    </main>
  );
}
