import { describe, expect, it } from "vitest"

import { gradeBreakdown } from "../src/formulas"

describe("gradeBreakdown", () => {
  it("rates dense text at a higher grade than simple text", () => {
    const simple = gradeBreakdown({ sentence: 5, word: 40, syllable: 50, complexWords: 1, characters: 160 })
    const dense = gradeBreakdown({ sentence: 2, word: 60, syllable: 160, complexWords: 25, characters: 480 })
    expect(dense.median).toBeGreaterThan(simple.median)
  })

  it("moves reading ease inversely to grade", () => {
    const simple = gradeBreakdown({ sentence: 5, word: 40, syllable: 50, complexWords: 1, characters: 160 })
    const dense = gradeBreakdown({ sentence: 2, word: 60, syllable: 160, complexWords: 25, characters: 480 })
    expect(simple.readingEase).toBeGreaterThan(dense.readingEase)
  })

  it("returns the median of exactly the five grade formulas", () => {
    const g = gradeBreakdown({ sentence: 3, word: 60, syllable: 100, complexWords: 8, characters: 300 })
    const sorted = [g.fleschKincaid, g.gunningFog, g.smog, g.colemanLiau, g.ari].sort((a, b) => a - b)
    expect(g.median).toBe(sorted[2])
  })
})
