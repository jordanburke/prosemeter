/**
 * lexical-diversity — MTLD scored against a natural band (~[50, 120]). Bidirectional: very low
 * diversity reads repetitive, very high reads scattered. Skipped for documents under 100 words,
 * below which MTLD is unreliable.
 */

import type { DimensionProvider, DimensionResult } from "@prosemeter/core"
import { band } from "@prosemeter/core"
import { None, Some, Try } from "functype"

import { mtld } from "./mtld"
import { collectWords } from "./words"

const BAND_LO = 50
const BAND_HI = 120
const KB = 0.0004
const MIN_WORDS = 100

export const lexicalDiversityProvider: DimensionProvider = {
  id: "lexical-diversity",
  defaultWeight: 0.05,
  evaluate: (doc, settings) =>
    Try((): DimensionResult => {
      if (doc.stats.words < MIN_WORDS) {
        return {
          id: "lexical-diversity",
          score: 0,
          weight: settings.weight,
          detail: `skipped: too short for MTLD (need >= ${MIN_WORDS} words, have ${doc.stats.words})`,
          findings: [],
          skipped: Some(`too short for MTLD (< ${MIN_WORDS} words)`),
        }
      }

      const tokens = collectWords(doc.nlcst).map((t) => t.text.toLowerCase())
      const value = mtld(tokens)
      return {
        id: "lexical-diversity",
        score: band(value, BAND_LO, BAND_HI, KB),
        weight: settings.weight,
        detail: `MTLD ${value.toFixed(1)} vs band ${BAND_LO}–${BAND_HI}`,
        findings: [],
        skipped: None(),
      }
    }),
}
