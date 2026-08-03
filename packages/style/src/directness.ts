/** directness — flags weasel words, hedges, and intensifiers via retext-intensify. Density-scored. */

import retextIntensify from "retext-intensify"
import { unified } from "unified"

import { resolveIgnore } from "./ignore-options"
import { retextDensityDimension } from "./retext-dimension"

/**
 * Words retext-intensify flags that are not hedges in technical prose.
 *
 * The plugin unions three wordlists — `fillers`, `hedges`, and `weasels` — and matches on the word
 * alone, with no regard for syntactic role. `weasels` in particular carries ordinary grammar
 * (`that` as a complementizer, `so` as a conjunction, `up`/`back`/`down` as phrasal-verb particles)
 * and a set of plain verbs (`works`, `helps`, `supports`, `started`) that are only "weasels" under
 * the narrative-writing advice the list was drawn from — the filtering-verb rule, as in "he felt the
 * wind" for "the wind blew". Technical prose uses them literally.
 *
 * Measured cost of leaving them in: on the calibration fixtures the dimension scored
 * `chat-jargon.md` (35) *above* `chat-clear.md` (24), i.e. it ran backwards, on 13 "hedges" in 160
 * words of prose containing essentially none.
 *
 * Deliberately kept flagged, because they do hedge in technical writing: `appears`, `seems`,
 * `believed`, `considered`, `supposed`, `thought`, `probably`, `might`, `could`, `arguably`,
 * `clearly`, `fairly`, `relatively`, `several`, `various`, and the intensifiers.
 */
export const HEDGE_IGNORE_DEFAULT: ReadonlyArray<string> = [
  // Grammar and function words — flagged regardless of role.
  "that",
  "so",
  "then",
  "also",
  "again",
  "even",
  "only",
  "all",
  "like",
  "over",
  "down",
  "up",
  "back",
  "close",
  "far",
  "own",
  "still",
  "well",
  "enough",
  // Plain verbs. Perception and cognition verbs that genuinely hedge a claim are NOT here.
  "acts",
  "began",
  "combats",
  "decided",
  "felt",
  "gains",
  "heard",
  "helps",
  "improved",
  "knew",
  "looked",
  "noticed",
  "realised",
  "realized",
  "recognised",
  "recognized",
  "saw",
  "smelled",
  "started",
  "supports",
  "touched",
  "understood",
  "wanted",
  "watched",
  "wished",
  "wondered",
  "works",
]

export const directnessProvider = retextDensityDimension({
  id: "directness",
  defaultWeight: 0.05,
  rule: "retext-intensify",
  k: 0.04,
  label: "weasel/hedge word(s)",
  fallbackHint: "Cut the hedge or replace it with a concrete claim.",
  buildProcessor: (options) => unified().use(retextIntensify, { ignore: resolveIgnore(options, HEDGE_IGNORE_DEFAULT) }),
})
