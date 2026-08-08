/**
 * Layout invariants, checked in a real browser against the real build.
 *
 * **Not a pixel-diff suite, on purpose.** Screenshot baselines fail on font hinting and antialiasing
 * differences between a dev machine and a CI runner, so they get re-baselined until nobody reads the
 * diff. Every assertion here instead states a property the page must have, in the browser's own
 * computed values — deterministic, and it says what broke rather than showing that something did.
 *
 * Each check exists because the thing it checks shipped broken:
 *
 * | check | what shipped |
 * | --- | --- |
 * | band children are centred | `.claim { margin: 2rem 0 }` reset `.band > *`'s `margin-inline: auto`, twice |
 * | one h1 per page | study pages carried the page title and the report's own `#` title |
 * | table cells are styled | `site.css` scopes tables to `table.dims`; rendered markdown has no class |
 * | nothing overflows the page | the rule wide content must scroll inside its own box |
 *
 * A human still has to look at the page. These catch the class of failure that is invisible to
 * `astro check` and to reading the CSS, which is the class that kept reaching production.
 */

import { expect, test, type Page } from "@playwright/test"

const PAGES = ["/", "/use", "/research", "/research/bluf-as-a-label"] as const

/** Phone, tablet, desktop. The narrow ones are where overflow shows up. */
const VIEWPORTS = [
  { name: "narrow", width: 375, height: 800 },
  { name: "medium", width: 768, height: 900 },
  { name: "wide", width: 1440, height: 900 },
] as const

test.describe("every page", () => {
  for (const path of PAGES) {
    test(`${path} has exactly one h1`, async ({ page }) => {
      // A 404 page has one h1 and no overflow, so every check below passes on a page that no longer
      // exists. Rename a route and the suite would have stayed green. Verified: /research/nope 404s
      // and satisfies the h1, overflow and centring assertions.
      const response = await page.goto(path)
      expect(response?.ok(), `${path} should return 2xx, not ${response?.status()}`).toBe(true)
      // Counts rendered headings, including any a markdown body contributes. A visually-hidden
      // duplicate still counts — hiding it is not the fix, removing it from the outline is.
      const visible = await page.locator("h1:visible").count()
      expect(visible, `${path} should have one visible h1`).toBe(1)
    })

    test(`${path} keeps its content inside the band column`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const response = await page.goto(path)
      expect(response?.ok(), `${path} should return 2xx, not ${response?.status()}`).toBe(true)

      const { offenders, measured } = await page.evaluate(() => {
        const bad: Array<{ tag: string; cls: string; left: number; right: number }> = []
        let seen = 0
        for (const band of document.querySelectorAll(".band")) {
          const bandBox = band.getBoundingClientRect()
          const style = getComputedStyle(band)
          const padLeft = parseFloat(style.paddingLeft)
          const padRight = parseFloat(style.paddingRight)
          const innerLeft = bandBox.left + padLeft
          const innerRight = bandBox.right - padRight

          for (const child of band.children) {
            const box = child.getBoundingClientRect()
            if (box.width === 0 || box.height === 0) continue
            // Only meaningful for a child narrower than the column it sits in; a full-width child
            // has no room to be off-centre.
            if (box.width >= innerRight - innerLeft - 1) continue
            seen++
            const gapLeft = box.left - innerLeft
            const gapRight = innerRight - box.right
            if (Math.abs(gapLeft - gapRight) > 2) {
              bad.push({
                tag: child.tagName.toLowerCase(),
                cls: child.className.toString().slice(0, 60),
                left: Math.round(gapLeft),
                right: Math.round(gapRight),
              })
            }
          }
        }
        return { offenders: bad, measured: seen }
      })

      // Without this the check can go vacuous in silence. Every guard above is a `continue`, so if
      // `--shell` ever grows past the test viewport each child counts as full-width, nothing is
      // measured, and the assertion below passes forever on every page.
      expect(measured, `${path}: no band children were measured — the check has gone vacuous`).toBeGreaterThan(0)

      expect(
        offenders,
        `${path}: these direct children of .band are not centred in their column — ` +
          `usually a \`margin\` shorthand with a 0 in the inline slot overriding \`margin-inline: auto\``,
      ).toEqual([])
    })
  }
})

/**
 * No direct child of a band may be wider than the column the band defines.
 *
 * The centring check cannot catch this: it skips any child as wide as its container, on the
 * reasoning that a full-width child has no room to be off-centre. A child that *escapes* the column
 * is exactly that case, so it was skipped — and three report tables shipped 1400px wide in a 1088px
 * column, sitting against the left padding edge while the prose around them stayed centred.
 *
 * `.band > *` sets `max-width: var(--shell)`. Anything wider has overridden it, which on this site
 * has never once been deliberate.
 */
test.describe("nothing escapes the band column", () => {
  for (const path of PAGES) {
    test(path, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const response = await page.goto(path)
      expect(response?.ok(), `${path} should return 2xx, not ${response?.status()}`).toBe(true)

      const wide = await page.evaluate(() => {
        const shell = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--shell")) * 16
        const out: Array<{ tag: string; width: number; shell: number }> = []
        for (const child of document.querySelectorAll(".band > *")) {
          const box = child.getBoundingClientRect()
          if (box.width > shell + 2) {
            out.push({ tag: child.tagName.toLowerCase(), width: Math.round(box.width), shell: Math.round(shell) })
          }
        }
        return out
      })

      expect(wide, `${path}: these overflow the --shell column, usually by overriding max-width`).toEqual([])
    })
  }
})

test.describe("no horizontal overflow", () => {
  for (const path of PAGES) {
    for (const vp of VIEWPORTS) {
      test(`${path} at ${vp.name} (${vp.width}px)`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        const response = await page.goto(path)
        expect(response?.ok(), `${path} should return 2xx, not ${response?.status()}`).toBe(true)

        // `clientWidth`, not `window.innerWidth`: innerWidth includes space a classic scrollbar
        // reserves, which would hide up to ~15px of real overflow anywhere overlay scrollbars are
        // not in use. Identical under the headless shell CI runs; correct everywhere else too.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        expect(overflow, "the page body must never scroll horizontally").toBeLessThanOrEqual(1)
      })
    }
  }
})

/**
 * Rendered report tables carry no class, so nothing scoped to `table.dims` reaches them. This asserts
 * they were styled at all, and that a wide one scrolls inside its own box rather than the page.
 */
test("report tables are styled and scroll inside themselves", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const response = await page.goto("/research/bluf-as-a-label")
  expect(response?.ok(), "the study page should return 2xx").toBe(true)

  const tables = page.locator(".report table")
  const count = await tables.count()
  expect(count, "the study report should render at least one markdown table").toBeGreaterThan(0)

  const report = await page.evaluate(() => {
    const out: Array<{ padding: string; border: string; overflowX: string; overflows: boolean }> = []
    for (const table of document.querySelectorAll(".report table")) {
      const cell = table.querySelector("td, th")
      const cellStyle = cell === null ? null : getComputedStyle(cell)
      out.push({
        padding: cellStyle?.paddingRight ?? "0px",
        border: cellStyle?.borderBottomWidth ?? "0px",
        overflowX: getComputedStyle(table).overflowX,
        overflows: table.scrollWidth > table.clientWidth,
      })
    }
    return out
  })

  for (const [i, t] of report.entries()) {
    expect(parseFloat(t.padding), `table ${i}: cells have no horizontal padding — unstyled`).toBeGreaterThan(0)
    expect(parseFloat(t.border), `table ${i}: cells have no bottom border — unstyled`).toBeGreaterThan(0)
    if (t.overflows) {
      expect(["auto", "scroll"], `table ${i} is wider than its box, so it must scroll itself`).toContain(t.overflowX)
    }
  }
})

/**
 * The demo is the page's reason to exist, and it depends on a worker that has broken twice — once on
 * an export condition, once on a UMD guard. Neither showed up in a build.
 *
 * **So this test has to interact.** The first result is rendered at build time into static HTML, by
 * design, so the page works with JavaScript disabled. An earlier version asserted only that a score
 * was on the page — which passes with JavaScript off entirely, and would go green while the worker
 * chunk 404s. Clicking a register forces a real round trip through the worker.
 */
test("the scorer demo scores through the worker, not just at build time", async ({ page }) => {
  const response = await page.goto("/")
  expect(response?.ok(), "/ should return 2xx").toBe(true)

  const headline = page.locator(".headline").first()
  await expect(headline).toBeVisible()
  // The build-time render. Carries the engine version, which is how a quoted score stays checkable.
  await expect(headline).toContainText(/\/100/)
  await expect(headline).toContainText(/v\d+\.\d+\.\d+/)

  const before = (await headline.textContent()) ?? ""

  // Switching register replaces the textarea and re-scores. The two register fixtures are far apart
  // by construction — one deliberately jargon-heavy, one deliberately plain — so the headline must
  // change. If the worker never answers, this times out rather than passing quietly.
  await page.locator("[data-fixture].reg").nth(1).click()
  await expect(headline).not.toHaveText(before, { timeout: 15_000 })

  // A worker that errored could still blank the panel. Assert a real score came back.
  await expect(headline).toContainText(/\/100/)
  await expect(headline).toContainText(/\d+ words/)
})
