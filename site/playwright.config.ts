import { defineConfig, devices } from "@playwright/test"

/**
 * Layout checks against the built site.
 *
 * Runs on the real build via `astro preview`, not the dev server, because the bugs these catch were
 * all in production output: a scoped rule that overrode a global one after bundling, a class name
 * that resolved to nothing, and markdown that no stylesheet reached.
 *
 * Chromium only, and deliberately not a pixel-diff suite — see `tests/layout.spec.ts` for why.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: 0,
  reporter: process.env.CI !== undefined ? "github" : "list",
  use: {
    baseURL: "http://localhost:4325",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // `validate` and `test:layout` both build first, so the server only serves.
    //
    // Port 4325, not Astro's default 4321, and never reuse an existing server. Both guard the same
    // false green: with 4321 and `reuseExistingServer`, a developer running `pnpm dev` gets a fresh
    // build from validate and then a suite run against the *dev server* — the opposite of this
    // config's stated purpose, since every bug it catches was in production output. A stale server
    // already produced one false result during development. Build is 1.5s and the suite 4s, so
    // there is nothing worth reusing.
    command: "pnpm preview --port 4325",
    url: "http://localhost:4325",
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
