import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Enforced, not aspirational. The include glob above is only a file
    // filter — it cannot stop a test from importing the Prisma client. The
    // reason nothing reaches the database today is Vite's default envPrefix
    // of "VITE_", which an exported DATABASE_URL in the developer's shell
    // defeats completely. This DATABASE_URL points at PRODUCTION, so blank it
    // for every test run: a test that tries to reach the database now fails
    // loudly on connection instead of quietly succeeding against live data.
    //
    // The four Google Ads variables are blanked for the same reason a test
    // must not depend on the developer's shell: they switch the public
    // site's Privacy text (src/lib/ttc/ads.ts), and every test that pins
    // that text expects the OFF state. The tests of the ON state set them
    // themselves (views/ads-pages.test.ts).
    env: {
      DATABASE_URL: "",
      NEXT_PUBLIC_GOOGLE_ADS_ID: "",
      NEXT_PUBLIC_GOOGLE_ADS_LABEL_FORM: "",
      NEXT_PUBLIC_GOOGLE_ADS_LABEL_CALL: "",
      NEXT_PUBLIC_GOOGLE_ADS_LABEL_WHATSAPP: "",
    },
  },
});
