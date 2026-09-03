import { describe, expect, it } from "vitest"

import { gradeBreakdown } from "../src/formulas"

describe("gradeBreakdown", () => {
  it("rates dense text at a higher grade than simple text", () => {
    const simple = gradeBreakdown({ sentence: 5, word: 40, syllable: 50, complexWords: 1, characters: 160 })
    const dense = gradeBreakdown({ sentence: 2, word: 60, syllable: 160, complexWords: 25, characters: 480 })
    expect(dense.pooledGrade).toBeGreaterThan(simple.pooledGrade)
  })

  it("moves reading ease inversely to grade", () => {
    const simple = gradeBreakdown({ sentence: 5, word: 40, syllable: 50, complexWords: 1, characters: 160 })
    const dense = gradeBreakdown({ sentence: 2, word: 60, syllable: 160, complexWords: 25, characters: 480 })
    expect(simple.readingEase).toBeGreaterThan(dense.readingEase)
  })

  it("pools SMOG, Gunning Fog and Flesch-Kincaid, and nothing else", () => {
    const g = gradeBreakdown({ sentence: 3, word: 60, syllable: 100, complexWords: 8, characters: 300 })
    expect(g.pooledGrade).toBeCloseTo((g.smog + g.gunningFog + g.fleschKincaid) / 3, 10)
  })

  /**
   * Coleman-Liau and ARI are computed and reported, and deliberately not pooled: measured against
   * 4,724 human-rated CLEAR excerpts they are the weakest two (-0.479 and -0.497 against the pool's
   * -0.560). Pinning this stops them being folded back in without a measurement.
   */
  it("excludes Coleman-Liau and ARI from the pool while still reporting them", () => {
    const g = gradeBreakdown({ sentence: 2, word: 60, syllable: 160, complexWords: 25, characters: 480 })
    expect(g.colemanLiau).toBeTypeOf("number")
    expect(g.ari).toBeTypeOf("number")
    expect(g.pooledGrade).not.toBeCloseTo((g.smog + g.gunningFog + g.fleschKincaid + g.colemanLiau + g.ari) / 5, 3)
  })

  /**
   * SMOG alone correlates best with human ease (-0.575) but its constant floors it near 3.1, so it
   * cannot register how extreme telegraphic prose is — on its own, `choppy-simplistic.md` scored
   * exactly at the chat threshold instead of below it. Flesch-Kincaid and Fog supply the low end.
   */
  it("goes well below SMOG's floor on telegraphic input", () => {
    const choppy = gradeBreakdown({ sentence: 12, word: 36, syllable: 40, complexWords: 0, characters: 140 })
    expect(choppy.smog).toBeGreaterThan(3)
    expect(choppy.pooledGrade).toBeLessThan(3)
  })
})
