/**
 * Fail the build if a Node built-in is reachable from `prosemeter`'s root export.
 *
 * The site scores in the browser, so `import { score } from "prosemeter"` must not drag `node:fs`
 * into the bundle. That invariant is invisible in the source — it only exists in the built output,
 * because whether `score` and `loadBaseline` share a chunk is a bundler decision.
 *
 * It has been broken once already: a single value re-export of `./baseline` from the entry put
 * `node:fs` in the same chunk as `score`. See packages/prosemeter/src/index.ts.
 *
 * This lives here rather than in packages/prosemeter/test/ because that package's `validateChain`
 * runs `test` before `build`, so a dist-reading test would read stale or missing output on a clean
 * checkout. Turbo's `dependsOn: ["^build"]` guarantees the site sees a fresh dist.
 */

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const IMPORT_SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g

const walk = (entry) => {
  const seen = new Set()
  const offenders = []

  const visit = (file) => {
    if (seen.has(file)) return
    seen.add(file)

    let source
    try {
      source = readFileSync(file, "utf8")
    } catch (error) {
      throw new Error(`assert-browser-safe: cannot read ${file} — has prosemeter been built?\n${error.message}`)
    }

    for (const [, specifier] of source.matchAll(IMPORT_SPECIFIER)) {
      if (specifier.startsWith("node:")) {
        offenders.push({ file, specifier })
      } else if (specifier.startsWith(".")) {
        visit(resolve(dirname(file), specifier))
      }
    }
  }

  visit(entry)
  return { walked: seen.size, offenders }
}

const entry = fileURLToPath(import.meta.resolve("prosemeter"))
const { walked, offenders } = walk(entry)

if (offenders.length > 0) {
  console.error(`\nprosemeter's root export reaches ${offenders.length} Node built-in(s):\n`)
  for (const { file, specifier } of offenders) console.error(`  ${file}\n    -> ${specifier}`)
  console.error(
    `\nThe site scores in the browser, so the root export must stay Node-free.\n` +
      `Anything touching the filesystem belongs behind its own subpath export, as\n` +
      `baseline persistence does at "prosemeter/baseline".\n`,
  )
  process.exit(1)
}

console.log(`browser-safe: ${walked} modules reachable from prosemeter's root export, no node: builtins`)
