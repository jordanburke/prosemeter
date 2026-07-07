import { None, Some } from "functype"
import { describe, expect, it } from "vitest"

import { checkConvergence, compareBaseline } from "../src/loop"
import type { Finding, ScoreResult } from "../src/types"

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

  it("treats a sustained decline as a stop signal (plateaued, not improving)", () => {
    expect(checkConvergence([80, 70, 60])).toBe("plateaued")
  })

  it("handles short histories", () => {
    expect(checkConvergence([])).toBe("improving")
    expect(checkConvergence([50])).toBe("improving")
  })
})
