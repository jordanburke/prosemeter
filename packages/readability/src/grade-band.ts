/**
 * grade-band — the document's overall reading grade vs the profile's target band.
 *
 * Median of Flesch-Kincaid, Gunning Fog, SMOG, Coleman-Liau, and ARI, scored with the band strategy.
 * No findings (it's a document-level signal); the detail reports every formula plus Flesch Reading
 * Ease.
 *
 * `direction` selects which side of the band is enforced:
 *
 * - `both` (default) — penalize reading too hard *and* too simplistic.
 * - `floor` — penalize only the simplistic side; anything at or above `lo` scores 1.
 * - `ceiling` — penalize only the hard side; anything at or below `hi` scores 1.
 *
 * **No built-in profile sets `direction`, and the evidence says they should not.** It exists for
 * callers scoring a pre-filtered corpus, where one side of the band can never fire.
 *
 * The option came out of a challenge to the ceiling's usefulness. Over 416 agent answers the
 * dimension scored exactly 100 on 87.5%, and of the 28 that fell below 90, 26 read too simply and
 * only 2 too hard — both of which `sentence-simplicity` had already scored 45 and 33. That argued
 * the ceiling was redundant. It is not: the corpus was 416 answers written by an agent asked to be
 * clear, so it contained almost nothing for a ceiling to catch. Against `chat-jargon.md` (median
 * grade 25.8) floor-only scores a perfect 100 and collapses the calibration spread from 44 points
 * to 21. Do not infer a guard rail is useless from a population that never hits it.
 *
 * The floor is separately load-bearing, and for a reason that does survive: `sentence-simplicity`
 * counts *hard* sentences, so it is blind to triviality by construction. It rated 26 of the 57
 * sub-grade-7 answers a perfect 100.
 */

import type { DimensionProvider, DimensionResult } from "@prosemeter/core"
import { band } from "@prosemeter/core"
import { None, Some, Try } from "functype"

import { gradeBreakdown } from "./formulas"

const MIN_WORDS = 30
// Calibrated (Phase 4): softer than the default band so normal prose a grade or two off the target
// band is not punished disproportionately.
const KB = 0.25

const fmt = (n: number): string => n.toFixed(1)

export type BandDirection = "both" | "floor" | "ceiling"

const directionOf = (options: Readonly<Record<string, unknown>>): BandDirection =>
  options.direction === "floor" || options.direction === "ceiling" ? options.direction : "both"

/** Open the unenforced side so `band` scores it 1 regardless of distance. */
const boundsFor = (direction: BandDirection, lo: number, hi: number): readonly [number, number] =>
  direction === "floor" ? [lo, Infinity] : direction === "ceiling" ? [-Infinity, hi] : [lo, hi]

export const gradeBandProvider: DimensionProvider = {
  id: "grade-band",
  defaultWeight: 0.2,
  evaluate: (doc, settings) =>
    Try((): DimensionResult => {
      if (doc.stats.words < MIN_WORDS) {
        return {
          id: "grade-band",
          score: 0,
          weight: settings.weight,
          detail: `skipped: too short for reliable formulas (need >= ${MIN_WORDS} words, have ${doc.stats.words})`,
          findings: [],
          skipped: Some(`too short for reliable formulas (< ${MIN_WORDS} words)`),
        }
      }

      const g = gradeBreakdown({
        sentence: doc.stats.sentences,
        word: doc.stats.words,
        syllable: doc.stats.syllables,
        complexWords: doc.stats.complexWords,
        characters: doc.stats.characters,
      })
      const { lo, hi } = settings.gradeBand
      const direction = directionOf(settings.options)
      const [bLo, bHi] = boundsFor(direction, lo, hi)
      const bandLabel =
        direction === "floor" ? `floor ${lo}` : direction === "ceiling" ? `ceiling ${hi}` : `${lo}–${hi}`

      return {
        id: "grade-band",
        score: band(g.median, bLo, bHi, KB),
        weight: settings.weight,
        detail:
          `median grade ${fmt(g.median)} vs band ${bandLabel} ` +
          `(FK ${fmt(g.fleschKincaid)}, Fog ${fmt(g.gunningFog)}, SMOG ${fmt(g.smog)}, ` +
          `CL ${fmt(g.colemanLiau)}, ARI ${fmt(g.ari)}); Flesch Reading Ease ${fmt(g.readingEase)}`,
        findings: [],
        skipped: None(),
      }
    }),
}
