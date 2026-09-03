/**
 * The five grade-level formulas plus Flesch Reading Ease, all fed from the same count bundle so a
 * document and a single sentence go through identical math. The count field names match core's
 * `DocumentStats` (`complexWords` serves as both `complexPolysillabicWord` and `polysillabicWord`;
 * `characters` serves as both `letter` and `character`).
 */

import { automatedReadability } from "automated-readability"
import { colemanLiau } from "coleman-liau"
import { flesch } from "flesch"
import { fleschKincaid } from "flesch-kincaid"
import { gunningFog } from "gunning-fog"
import { smogFormula } from "smog-formula"

export type Counts = {
  readonly sentence: number
  readonly word: number
  readonly syllable: number
  /** Words of 3+ syllables — feeds Gunning Fog and SMOG. */
  readonly complexWords: number
  /** Letters/digits — feeds Coleman-Liau and ARI. */
  readonly characters: number
}

export type GradeBreakdown = {
  readonly fleschKincaid: number
  readonly gunningFog: number
  readonly smog: number
  readonly colemanLiau: number
  readonly ari: number
  /**
   * The pooled grade the band strategy scores: the mean of SMOG, Gunning Fog and Flesch-Kincaid.
   *
   * Was the median of all five. Measured against 4,724 human-rated CLEAR excerpts, that median
   * correlated -0.528 with human ease while this mean reaches -0.560, because Coleman-Liau (-0.479)
   * and ARI (-0.497) are the weak two and a median lets them pull the result down.
   *
   * SMOG alone is stronger still (-0.575) and cannot be used on its own: its constant floors it at
   * about 3.1, so it cannot register how extreme telegraphic prose is, and `choppy-simplistic.md`
   * scored exactly at the chat threshold rather than below it. Flesch-Kincaid and Fog restore the
   * low-end sensitivity that guard rail needs. See LIB_RPT_clear-corpus-validation_2026-08-29.md.
   */
  readonly pooledGrade: number
  /** Flesch Reading Ease (0–100, higher = easier) — reported as info, not scored. */
  readonly readingEase: number
}

export const gradeBreakdown = (c: Counts): GradeBreakdown => {
  const fk = fleschKincaid({ sentence: c.sentence, word: c.word, syllable: c.syllable })
  const fog = gunningFog({ sentence: c.sentence, word: c.word, complexPolysillabicWord: c.complexWords })
  const smog = smogFormula({ sentence: c.sentence, polysillabicWord: c.complexWords })
  const cl = colemanLiau({ sentence: c.sentence, word: c.word, letter: c.characters })
  const ar = automatedReadability({ sentence: c.sentence, word: c.word, character: c.characters })
  return {
    fleschKincaid: fk,
    gunningFog: fog,
    smog,
    colemanLiau: cl,
    ari: ar,
    pooledGrade: (smog + fog + fk) / 3,
    readingEase: flesch({ sentence: c.sentence, word: c.word, syllable: c.syllable }),
  }
}
