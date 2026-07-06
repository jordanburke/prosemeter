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
  /** Median of the five grade formulas — the single number the band strategy scores. */
  readonly median: number
  /** Flesch Reading Ease (0–100, higher = easier) — reported as info, not scored. */
  readonly readingEase: number
}

const median5 = (values: ReadonlyArray<number>): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
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
    median: median5([fk, fog, smog, cl, ar]),
    readingEase: flesch({ sentence: c.sentence, word: c.word, syllable: c.syllable }),
  }
}
