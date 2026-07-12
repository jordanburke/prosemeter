import { None, Some } from "functype"
import { describe, expect, it } from "vitest"

import { checkConvergence, checkConvergenceDetailed, compareBaseline } from "../src/loop"
import type { DimensionHistory, Finding, ScoreResult } from "../src/types"

const finding = (excerpt: string, line: number): Finding => ({
  rule: "sentence-length",
  dimension: "sentence-complexity",
  severity: "warn",
  message: "hard",
  hint: "split it",
  loc: Some({ line, column: 1, offset: 0, length: 10 }),
  excerpt,
})

const result = (score: number, findings: ReadonlyArray<Finding>, dimScore = score / 100): ScoreResult => ({
  target: "t",
  profile: "plain",
  score,
  stats: {
    words: 100,
    sentences: 10,
    paragraphs: 3,
    characters: 400,
    syllables: 150,
    complexWords: 10,
    headings: [],
    codeBlocks: 0,
    links: 0,
    listItems: 0,
  },
  dimensions: [{ id: "sentence-complexity", score: dimScore, weight: 0.1, detail: "", findings, skipped: None() }],
  version: "0.1.0",
})

describe("compareBaseline", () => {
  it("reports score delta and verdict", () => {
    const report = compareBaseline(result(74, []), result(62, []))
    expect(report.scoreDelta).toBe(12)
    expect(report.verdict).toBe("improved")
  })

  it("treats |delta| < 1 as unchanged", () => {
    expect(compareBaseline(result(74, []), result(74, [])).verdict).toBe("unchanged")
  })

  it("finds resolved and new findings", () => {
    const baseline = result(60, [finding("the old passive sentence here", 3)])
    const current = result(70, [finding("a brand new tangled clause", 4)])
    const report = compareBaseline(current, baseline)
    expect(report.findingsResolved.map((f) => f.excerpt)).toEqual(["the old passive sentence here"])
    expect(report.findingsNew.map((f) => f.excerpt)).toEqual(["a brand new tangled clause"])
  })

  it("is location-independent: the same finding at a shifted line is neither new nor resolved", () => {
    const baseline = result(60, [finding("An identical sentence that only moved.", 5)])
    const current = result(60, [finding("an   identical sentence   that only moved.", 42)])
    const report = compareBaseline(current, baseline)
    expect(report.findingsResolved).toEqual([])
    expect(report.findingsNew).toEqual([])
  })
})

describe("checkConvergence", () => {
  it("converges when the latest score meets the threshold", () => {
    expect(checkConvergence([70, 82, 86], { threshold: 85 })).toBe("converged")
    expect(checkConvergence([90])).toBe("improving") // no threshold supplied
  })

  it("detects a plateau when all recent deltas are small", () => {
    expect(checkConvergence([80, 80.2, 80.1, 80.3])).toBe("plateaued")
  })

  it("detects oscillation when significant deltas alternate sign", () => {
    expect(checkConvergence([50, 60, 50, 60])).toBe("oscillating")
  })

  it("reports improving while climbing", () => {
    expect(checkConvergence([50, 60, 70])).toBe("improving")
    expect(checkConvergence([62, 71, 74, 74.5])).toBe("improving")
  })

  it("reports a sustained decline as regressing, not plateaued", () => {
    expect(checkConvergence([80, 70, 60])).toBe("regressing")
    expect(checkConvergence([70, 65, 58, 50])).toBe("regressing")
  })

  it("keeps a genuinely flat window as plateaued (all deltas < epsilon)", () => {
    expect(checkConvergence([70, 69.5, 70.2, 69.8])).toBe("plateaued")
  })

  it("treats a single significant drop in an otherwise-quiet window as plateaued, not a trend", () => {
    expect(checkConvergence([70, 70.2, 64])).toBe("plateaued")
  })

  it("does not classify a mixed [+,-,-] window as regressing (requires all-negative)", () => {
    expect(checkConvergence([70, 80, 60, 50])).toBe("plateaued")
  })

  it("keeps oscillation classified as oscillating, not regressing", () => {
    expect(checkConvergence([60, 68, 62, 70])).toBe("oscillating")
  })

  it("handles short histories", () => {
    expect(checkConvergence([])).toBe("improving")
    expect(checkConvergence([50])).toBe("improving")
  })
})

describe("checkConvergenceDetailed", () => {
  const dim = (id: string, history: ReadonlyArray<number>): DimensionHistory => ({ id, history })

  it("flags the losing side of a dimension trade under a flat composite", () => {
    // Composite flat, but readability climbs 0.30→0.90 while style falls 0.90→0.30. Only the
    // regressing dimension is churn — the improving one is where the score came *from*, not the problem.
    const report = checkConvergenceDetailed(
      [70, 70.2, 69.9],
      [dim("readability", [0.3, 0.6, 0.9]), dim("style", [0.9, 0.6, 0.3])],
    )
    expect(report.verdict).toBe("plateaued")
    expect(report.churning).toEqual(["style"])
  })

  it("flags both dimensions when they oscillate against each other", () => {
    const report = checkConvergenceDetailed(
      [70, 70.1, 69.9],
      [dim("readability", [0.3, 0.9, 0.3]), dim("style", [0.9, 0.3, 0.9])],
    )
    expect(report.verdict).toBe("plateaued")
    expect([...report.churning].sort()).toEqual(["readability", "style"])
  })

  it("reports empty churning when the composite is flat and dimensions are flat", () => {
    const report = checkConvergenceDetailed(
      [70, 70.2, 69.9],
      [dim("readability", [0.7, 0.702, 0.699]), dim("style", [0.8, 0.798, 0.801])],
    )
    expect(report.verdict).toBe("plateaued")
    expect(report.churning).toEqual([])
  })

  it("never churns for a non-plateaued verdict", () => {
    const report = checkConvergenceDetailed([50, 60, 70], [dim("readability", [0.5, 0.1, 0.9])])
    expect(report.verdict).toBe("improving")
    expect(report.churning).toEqual([])
  })
})
