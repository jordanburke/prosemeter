import { fileURLToPath } from "node:url"

import type { ScoreResultJSON } from "prosemeter"
import { describe, expect, it } from "vitest"

import {
  checkConvergenceHandler,
  compareBaselineHandler,
  listProfilesHandler,
  scoreFileHandler,
  scoreTextHandler,
  ToolError,
} from "../src/handlers"

const SAMPLE =
  "# Guide\n\nThis tool scores prose and points out what to fix. It reads the whole document once, " +
  "then every check shares the same parsed tree so the results stay consistent and quick to produce.\n"

const fixture = (name: string): string => fileURLToPath(new URL(`../../../fixtures/${name}`, import.meta.url))

describe("scoreTextHandler", () => {
  it("returns a ScoreResult JSON string", () => {
    const parsed = JSON.parse(scoreTextHandler({ text: SAMPLE, profile: "readme" })) as ScoreResultJSON
    expect(typeof parsed.score).toBe("number")
    expect(parsed.dimensions.length).toBe(15)
    expect(parsed.profile).toBe("readme")
  })

  it("throws a ToolError for empty input", () => {
    expect(() => scoreTextHandler({ text: "   " })).toThrow(ToolError)
  })

  it("throws a ToolError for an unknown profile", () => {
    expect(() => scoreTextHandler({ text: SAMPLE, profile: "nope" })).toThrow(/not a known profile/)
  })
})

describe("scoreFileHandler", () => {
  it("scores a file on disk", () => {
    const parsed = JSON.parse(
      scoreFileHandler({ path: fixture("good-readme.md"), profile: "readme" }),
    ) as ScoreResultJSON
    expect(parsed.score).toBeGreaterThan(0)
  })

  it("throws a ToolError for a missing file", () => {
    expect(() => scoreFileHandler({ path: fixture("does-not-exist.md") })).toThrow(ToolError)
  })
})

describe("compareBaselineHandler", () => {
  it("diffs two ScoreResults into a DeltaReport", () => {
    const baseline = JSON.parse(scoreTextHandler({ text: SAMPLE, profile: "plain" })) as ScoreResultJSON
    const improved = JSON.parse(
      scoreTextHandler({
        text: `${SAMPLE}\n\nA second clean paragraph with clear, direct sentences.\n`,
        profile: "plain",
      }),
    ) as ScoreResultJSON
    const delta = JSON.parse(compareBaselineHandler({ current: improved, baseline })) as {
      scoreDelta: number
      verdict: string
    }
    expect(typeof delta.scoreDelta).toBe("number")
    expect(["improved", "regressed", "unchanged"]).toContain(delta.verdict)
  })
})

describe("checkConvergenceHandler", () => {
  it("classifies a score history", () => {
    const result = JSON.parse(checkConvergenceHandler({ history: [50, 60, 70] })) as { verdict: string; detail: string }
    expect(result.verdict).toBe("improving")
    expect(result.detail).toContain("50")
  })

  it("reports converged when the threshold is met", () => {
    const result = JSON.parse(checkConvergenceHandler({ history: [70, 82, 88], threshold: 85 })) as { verdict: string }
    expect(result.verdict).toBe("converged")
  })
})

describe("listProfilesHandler", () => {
  it("lists the six built-in profiles", () => {
    const profiles = JSON.parse(listProfilesHandler()) as ReadonlyArray<{ name: string }>
    expect(profiles.map((p) => p.name)).toEqual(["plain", "readme", "api-docs", "blog", "marketing", "academic"])
  })
})
