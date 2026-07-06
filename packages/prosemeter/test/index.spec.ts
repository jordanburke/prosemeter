import { describe, expect, it } from "vitest"

import { checkConvergence, compareBaseline, profiles, score, toScoreResultJSON } from "../src/index"

const sample =
  "# Guide\n\nThis tool scores prose and points out what to fix. It reads the whole document once " +
  "and then every check shares the same parsed tree, so the results stay consistent and fast to produce.\n"

describe("library API", () => {
  it("score returns a Right ScoreResult with the built-in dimensions", () => {
    score(sample, { profile: "readme" }).fold(
      (err) => {
        throw new Error(`expected Right, got ${JSON.stringify(err)}`)
      },
      (result) => {
        expect(result.profile).toBe("readme")
        const ids = result.dimensions.map((d) => d.id)
        expect(ids).toContain("grade-band")
        expect(ids).toContain("passive-voice")
        expect(ids).toContain("heading-hierarchy")
        expect(ids).toContain("lexical-diversity")
        expect(ids.length).toBe(15)
        expect(result.version).toBeTruthy()
      },
    )
  })

  it("score returns a Left ScoreError for empty input", () => {
    expect(score("   ").isLeft()).toBe(true)
  })

  it("toScoreResultJSON flattens Options to JSON-safe values", () => {
    const json = score(sample, { profile: "readme" }).fold(
      () => {
        throw new Error("expected Right")
      },
      (result) => toScoreResultJSON(result),
    )
    // Round-trips through JSON with no functype objects surviving.
    const reparsed = JSON.parse(JSON.stringify(json)) as typeof json
    expect(reparsed.dimensions.every((d) => d.skipped === null || typeof d.skipped === "string")).toBe(true)
  })

  it("profiles returns the six built-in summaries", () => {
    const names = profiles().map((p) => p.name)
    expect(names).toEqual(["plain", "readme", "api-docs", "blog", "marketing", "academic"])
  })

  it("re-exports the loop contract", () => {
    const a = score(sample, { profile: "readme" }).fold(
      () => undefined,
      (r) => r,
    )
    expect(a).toBeDefined()
    if (a) expect(compareBaseline(a, a).verdict).toBe("unchanged")
    expect(checkConvergence([50, 60, 70])).toBe("improving")
  })
})
