/**
 * Run data for the research pages, read from `eval/results/*.json` at build time.
 *
 * **No number on a research page is typed by hand.** The site already holds itself to that for the
 * scorer demo, and it matters more here: these pages make empirical claims, and a figure that drifts
 * from the data it cites is worse than no figure. Every mean below is computed from the committed
 * per-answer scores.
 *
 * Build-time only — `node:fs` must never reach the client graph. `site/scripts/assert-browser-safe.mjs`
 * enforces that for the scorer; this module is imported from Astro frontmatter, which runs in Node.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, resolve } from "node:path"

export type Answer = {
  readonly file: string
  readonly variant: string
  readonly replicate: string
  readonly task: string
  readonly composite: number
  readonly dimensions: Readonly<Record<string, number | null>>
  readonly stats: Readonly<Record<string, number>>
  readonly reviewerFinding: { readonly severity: string; readonly error: string | null } | null
}

export type RunResult = {
  readonly run: string
  readonly generated: string | null
  readonly model: string | null
  readonly note: string | null
  readonly profile: string
  readonly prosemeterVersion: string
  readonly n: number
  readonly variants: ReadonlyArray<string>
  readonly tasks: ReadonlyArray<string>
  readonly answers: ReadonlyArray<Answer>
}

/**
 * Walk up from the working directory to find `eval/results`.
 *
 * Not `import.meta.url`: this module is bundled into `dist/.prerender/chunks/` before it runs, so a
 * source-relative URL resolves against the bundle and misses by three directories. Not a fixed
 * `../eval/results` either — that assumes the build runs from `site/`, which `pnpm --filter` and the
 * deploy workflow do not guarantee. Searching upward is true under all of them.
 */
const findResults = (): string => {
  let at = resolve(process.cwd())
  for (;;) {
    const candidate = resolve(at, "eval/results")
    if (existsSync(candidate)) return candidate
    const up = dirname(at)
    if (up === at) throw new Error(`eval/results not found above ${process.cwd()}`)
    at = up
  }
}

const DIR = findResults()

export const runs = (): ReadonlyArray<RunResult> =>
  readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(resolve(DIR, f), "utf8")) as RunResult)

export const run = (id: string): RunResult | undefined => runs().find((r) => r.run === id)

const mean = (xs: ReadonlyArray<number>): number =>
  xs.length === 0 ? Number.NaN : xs.reduce((a, b) => a + b, 0) / xs.length

export type VariantRow = {
  readonly variant: string
  readonly n: number
  readonly composite: number
  readonly words: number
  readonly jargonPct: number
  readonly sentenceSimplicity: number
  readonly gradeBand: number
  readonly clarity: number
}

/**
 * Per-variant means for one run.
 *
 * `jargonPct` is complex words as a share of total, not a scored dimension — prosemeter scores a
 * document without knowing what question it answered, so it cannot say whether 341 words was the
 * right length. Vocabulary share is tracked here instead.
 */
export const variantRows = (r: RunResult): ReadonlyArray<VariantRow> =>
  r.variants.map((v) => {
    const rs = r.answers.filter((a) => a.variant === v)
    const dim = (id: string) => mean(rs.map((a) => a.dimensions[id]).filter((x): x is number => x !== null))
    return {
      variant: v,
      n: rs.length,
      composite: mean(rs.map((a) => a.composite)),
      words: mean(rs.map((a) => a.stats.words ?? 0)),
      jargonPct: mean(rs.map((a) => (100 * (a.stats.complexWords ?? 0)) / (a.stats.words || 1))),
      sentenceSimplicity: dim("sentence-simplicity"),
      gradeBand: dim("grade-band"),
      clarity: dim("clarity"),
    }
  })

/**
 * The within-variant composite spread, which is the reason these pages lead with dimensions.
 *
 * If the gap between two variants' composites is smaller than the spread inside either one, the gap
 * is not a result. Run 1 spanned 79.5–86.6 across seven variants on a ~15-point within-variant
 * spread, so no composite comparison in it meant anything.
 */
export const compositeSpread = (r: RunResult, variant: string): readonly [number, number] => {
  const xs = r.answers
    .filter((a) => a.variant === variant)
    .map((a) => a.composite)
    .sort((a, b) => a - b)
  return [xs[0] ?? Number.NaN, xs[xs.length - 1] ?? Number.NaN]
}

/** Totals across every committed run, for the index page's standfirst. */
export const corpusTotals = () => {
  const all = runs()
  return {
    answers: all.reduce((n, r) => n + r.n, 0),
    runs: all.length,
    reviewed: all.reduce((n, r) => n + r.answers.filter((a) => a.reviewerFinding !== null).length, 0),
    models: [...new Set(all.map((r) => r.model).filter((m): m is string => m !== null))].sort(),
  }
}
