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
    env: { DATABASE_URL: "" },
  },
});
