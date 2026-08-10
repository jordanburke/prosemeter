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

/**
 * Every scored run in `eval/results`.
 *
 * Filtered on the presence of `answers` rather than on the filename. `eval/results` also holds
 * `run-6-judgments.json`, which is a tally of blind human-style verdicts and has no per-answer
 * scores — folding it in made `corpusTotals().answers` NaN, and a NaN renders as "NaN answers" on
 * the page rather than failing the build.
 */
export const runs = (): ReadonlyArray<RunResult> =>
  readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(resolve(DIR, f), "utf8")) as Partial<RunResult>)
    .filter((r): r is RunResult => Array.isArray(r.answers))

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

/**
 * Run 6: the paired revision experiment.
 *
 * Different shape from every other run, so it gets its own reader. Runs 1–5 compare arm means over
 * separate answers; run 6 compares each revision to the exact run-5 draft it was made from, and the
 * two arms to each other within that origin. A mean over arm P and a mean over arm R would throw
 * away the pairing and could not see the effect at all — run 5's control arm spans 11 composite
 * points on six tasks under one instruction.
 */
export type RevisionLoop = {
  readonly n: number
  /** Mean composite gain of the findings-guided arm over the blind arm, same origin draft. */
  readonly guidedOverBlind: number
  /** Drafts where the guided arm scored higher. */
  readonly guidedHigher: number
  /** Mean composite gain of each arm over the draft it revised. */
  readonly blindOverOrigin: number
  readonly guidedOverOrigin: number
  /**
   * Largest |R−P| among dimensions no finding ever pointed at — the generalization test.
   *
   * A magnitude, not a gain: the largest of the five is `grade-band` at −0.4, where the guided arm
   * is *worse*. Reported as a bound on movement in either direction so it cannot be read as a win.
   */
  readonly largestUnmarkedGain: number
  /** Blind pairwise preference, from the preference-only judging pass. */
  readonly judge: {
    readonly blindWins: number
    readonly guidedWins: number
    readonly ties: number
    readonly explainBlindWins: number
    readonly explainGuidedWins: number
  }
}

const NEVER_MARKED = ["concision", "grade-band", "lexical-diversity", "paragraph-length", "spelling-consistency"]

export const revisionLoop = (): RevisionLoop | null => {
  const six = run("6")
  const five = run("5")
  if (six === undefined || five === undefined) return null

  const origin = new Map(five.answers.filter((a) => a.variant === "A").map((a) => [`${a.replicate}-${a.task}`, a]))
  const at = (variant: string, key: string) =>
    six.answers.find((a) => a.variant === variant && `${a.replicate}-${a.task}` === key)

  const keys = [...new Set(six.answers.map((a) => `${a.replicate}-${a.task}`))]
  const pairs = keys
    .map((k) => ({ k, p: at("P", k), r: at("R", k), o: origin.get(k) }))
    .filter((x): x is { k: string; p: Answer; r: Answer; o: Answer } => !!x.p && !!x.r && !!x.o)

  const meanOf = (xs: ReadonlyArray<number>) => (xs.length === 0 ? Number.NaN : xs.reduce((a, b) => a + b, 0) / xs.length)

  const unmarked = NEVER_MARKED.map((d) =>
    meanOf(
      pairs
        .map(({ p, r }) => {
          const a = r.dimensions[d]
          const b = p.dimensions[d]
          return a === null || a === undefined || b === null || b === undefined ? null : a - b
        })
        .filter((x): x is number => x !== null),
    ),
  ).filter((x) => !Number.isNaN(x))

  const j = JSON.parse(readFileSync(resolve(DIR, "run-6-judgments.json"), "utf8")) as {
    passes: { plain: { all: { betterP: number; betterR: number; tie: number }; explain: { betterP: number; betterR: number } } }
  }

  return {
    n: pairs.length,
    guidedOverBlind: meanOf(pairs.map(({ p, r }) => r.composite - p.composite)),
    guidedHigher: pairs.filter(({ p, r }) => r.composite > p.composite).length,
    blindOverOrigin: meanOf(pairs.map(({ p, o }) => p.composite - o.composite)),
    guidedOverOrigin: meanOf(pairs.map(({ r, o }) => r.composite - o.composite)),
    largestUnmarkedGain: Math.max(...unmarked.map(Math.abs)),
    judge: {
      blindWins: j.passes.plain.all.betterP,
      guidedWins: j.passes.plain.all.betterR,
      ties: j.passes.plain.all.tie,
      explainBlindWins: j.passes.plain.explain.betterP,
      explainGuidedWins: j.passes.plain.explain.betterR,
    },
  }
}
