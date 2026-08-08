/** directness — flags weasel words, hedges, and intensifiers via retext-intensify. Density-scored. */

import type { Finding, ParsedDocument } from "@prosemeter/core"
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
 * Entries are added from observed false positives, never from guesses about which words *ought* to
 * misfire. A word qualifies only if the flag is wrong in every context, not merely in the one that
 * surfaced it. A sweep over this repo's 22 markdown files produced 61 distinct flags; 9 met that
 * bar. Three of those were inflection gaps — `started`, `understood`, and `noticed` were already
 * ignored while `start`, `understand`, and `found` were not.
 *
 * Deliberately kept flagged, because they do hedge in technical writing: `appears`, `seems`,
 * `believed`, `considered`, `supposed`, `thought`, `probably`, `probable`, `might`, `could`,
 * `arguably`, `clearly`, `fairly`, `relatively`, `several`, `various`, `likely`, `substantially`,
 * `somewhat`, and the intensifiers. `some`, `most`, and `rather` stay too — they are the vague
 * quantifiers the list exists to catch.
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
  // Modal verbs. In technical advice these state capability, prediction, recommendation, and
  // obligation precisely — "you can drop it", "it will fail", "you should retry", "the key must be
  // stable". `may`, `might` and `could` stay flagged, because those do hedge a claim.
  "can",
  "will",
  "should",
  "must",
  "would",
  // Ordinary verbs, flagged by part-of-speech blindness.
  "read",
  "find",
  "found",
  "say",
  "says",
  "start",
  "understand",
  "understands",
  // `retext-simplify` recommends "try" as the replacement for "endeavor". Flagging it here made
  // clarity and directness contradict each other on the same word.
  "try",
  // A technical noun and adjective with no hedging sense — "diagnostic procedure", "the resultant
  // diagnostic". Sits in the upstream `hedges` list beside genuine hedges like `probable`.
  "diagnostic",
  // Precise in technical prose: "exactly one version", "the right index", "already hoisted",
  // "too slow", "much faster", "about the lockfile" (the preposition, not the approximation).
  "exactly",
  "already",
  "right",
  "real",
  "too",
  "much",
  "about",
]

/**
 * `May` before a number is the month, not the modal.
 *
 * The `hedges` list carries lowercase `may`, and the plugin matches case-insensitively, so every
 * date in a changelog or a timeline is flagged with "Cut the hedge or replace it with a concrete
 * claim." Observed twice in one document: "May 6, 2026" and "May 2025".
 *
 * `HEDGE_IGNORE_DEFAULT` cannot express this. Lowercase `may` genuinely hedges — "this may fail" —
 * and is deliberately kept flagged above. The word is a violation in one role and not in another,
 * which is a decision about the surrounding source rather than about the word.
 *
 * Deliberately narrow:
 *
 * - **Case-sensitive.** Only capitalised `May` qualifies. A sentence-initial modal ("May we
 *   suggest…") is also capitalised, which is why the digit is required — nobody writes "May we 6".
 * - **A digit must follow.** "May 6", "May 2025", "May 1st". Bare "In May we shipped it" stays
 *   flagged, which is the conservative outcome: it reads as a month to a human and as a hedge to the
 *   plugin, and under-filtering is the safer error.
 * - **`May` only.** No other month name appears in the `fillers`/`hedges`/`weasels` union, so
 *   generalising would be speculative.
 *
 * Scope, honestly: `May` + digit occurs zero times across the 416 eval answers, `fixtures/`, and
 * every markdown file in this repo. The corpus that surfaced it was pasted from outside. This is
 * shipped because the flag is wrong in every context the guard matches, not because the pattern is
 * common here — see the sweep note in the commit.
 */
const isMonthName = (finding: Finding, doc: ParsedDocument): boolean =>
  finding.excerpt === "May" &&
  finding.loc.fold(
    () => false,
    (l) => /^\s*\d/.test(doc.raw.slice(l.offset + l.length, l.offset + l.length + 8)),
  )

export const directnessProvider = retextDensityDimension({
  id: "directness",
  defaultWeight: 0.05,
  rule: "retext-intensify",
  k: 0.04,
  label: "weasel/hedge word(s)",
  fallbackHint: "Cut the hedge or replace it with a concrete claim.",
  buildProcessor: (options) => unified().use(retextIntensify, { ignore: resolveIgnore(options, HEDGE_IGNORE_DEFAULT) }),
  dropFinding: isMonthName,
})
