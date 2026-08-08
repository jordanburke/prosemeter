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
      await page.goto(path)
      // Counts rendered headings, including any a markdown body contributes. A visually-hidden
      // duplicate still counts — hiding it is not the fix, removing it from the outline is.
      const visible = await page.locator("h1:visible").count()
      expect(visible, `${path} should have one visible h1`).toBe(1)
    })

    test(`${path} keeps its content inside the band column`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(path)

      const offenders = await page.evaluate(() => {
        const bad: Array<{ tag: string; cls: string; left: number; right: number }> = []
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
        return bad
      })

      expect(
        offenders,
        `${path}: these direct children of .band are not centred in their column — ` +
          `usually a \`margin\` shorthand with a 0 in the inline slot overriding \`margin-inline: auto\``,
      ).toEqual([])
    })
  }
})

test.describe("no horizontal overflow", () => {
  for (const path of PAGES) {
    for (const vp of VIEWPORTS) {
      test(`${path} at ${vp.name} (${vp.width}px)`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.goto(path)

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
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
  await page.goto("/research/bluf-as-a-label")

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
 */
test("the scorer demo renders a score", async ({ page }: { page: Page }) => {
  await page.goto("/")
  const headline = page.locator(".headline").first()
  await expect(headline).toBeVisible()
  await expect(headline).toContainText(/\/100/)
  // Build-time render includes the engine version; it is how a quoted score stays checkable.
  await expect(headline).toContainText(/v\d+\.\d+\.\d+/)
})
