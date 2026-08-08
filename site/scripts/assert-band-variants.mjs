/**
 * Fail the build when a page uses a `band` variant the stylesheet does not define.
 *
 * `<div class="band alt">` is valid HTML, valid Astro, and passes `astro check`. It just does
 * nothing: `.band.alt` was never written, so four sections of `/research` shipped with no visual
 * separation between them and nobody found out until a human read the page.
 *
 * That is the whole category this guards — a class name is a string, and a typo'd one degrades
 * silently instead of erroring. The site's convention is `.band.tint`; anything else must be
 * defined before it can be used.
 */

import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

const root = new URL("..", import.meta.url).pathname

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

const css = readFileSync(join(root, "src/styles/site.css"), "utf8")
const sources = walk(join(root, "src")).filter((f) => f.endsWith(".astro"))

/** Variants the stylesheet defines, as `.band.<name>` selectors. */
const defined = new Set([...css.matchAll(/\.band\.([\w-]+)/g)].map((m) => m[1]))

/**
 * `report` is styled by a page-scoped block rather than in site.css, which is the right place for a
 * one-page concern. Listed here so the guard does not force it into the global sheet.
 */
const scoped = new Set(["report"])

const problems = []
for (const file of sources) {
  const text = readFileSync(file, "utf8")
  for (const m of text.matchAll(/class="band([^"]*)"/g)) {
    for (const variant of m[1].trim().split(/\s+/).filter(Boolean)) {
      if (!defined.has(variant) && !scoped.has(variant)) {
        problems.push(`${file.replace(root, "")}: class="band ${variant}" — no .band.${variant} rule`)
      }
    }
  }
}

if (problems.length > 0) {
  console.error("Undefined band variant(s):\n")
  for (const p of problems) console.error(`  ${p}`)
  console.error(`\nDefined: ${[...defined].sort().join(", ") || "(none)"}`)
  console.error("Add the rule to src/styles/site.css, or use an existing variant.")
  process.exit(1)
}

console.log(`band variants ok — ${sources.length} pages, defined: ${[...defined].sort().join(", ")}`)
