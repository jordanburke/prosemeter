/**
 * grade-band — the document's overall reading grade vs the profile's target band.
 *
 * Median of Flesch-Kincaid, Gunning Fog, SMOG, Coleman-Liau, and ARI, scored with the bidirectional
 * band strategy: a document can be flagged for reading too *hard* or too *simplistic*. No findings
 * (it's a document-level signal); the detail reports every formula plus Flesch Reading Ease.
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

      return {
        id: "grade-band",
        score: band(g.median, lo, hi, KB),
        weight: settings.weight,
        detail:
          `median grade ${fmt(g.median)} vs band ${lo}–${hi} ` +
          `(FK ${fmt(g.fleschKincaid)}, Fog ${fmt(g.gunningFog)}, SMOG ${fmt(g.smog)}, ` +
          `CL ${fmt(g.colemanLiau)}, ARI ${fmt(g.ari)}); Flesch Reading Ease ${fmt(g.readingEase)}`,
        findings: [],
        skipped: None(),
      }
    }),
}
