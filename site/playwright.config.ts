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
    baseURL: "http://localhost:4321",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // `validate` and `test:layout` both build first, so the server only serves.
    command: "pnpm preview --port 4321",
    url: "http://localhost:4321",
    reuseExistingServer: process.env.CI === undefined,
    timeout: 180_000,
  },
})
