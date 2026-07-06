import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { runScore } from "@prosemeter/core"
import type { DocumentFormat, ScoreResult } from "@prosemeter/core"
import { describe, expect, it } from "vitest"

import { readabilityProviders } from "../src/index"

const fixture = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`../../../fixtures/${name}`, import.meta.url)), "utf8")

const score = (raw: string, profile: string, format?: DocumentFormat): ScoreResult =>
  runScore(raw, readabilityProviders, { profile, format, target: "fixture", version: "test" }).fold(
    (err) => {
      throw new Error(`score failed: ${JSON.stringify(err)}`)
    },
    (r) => r,
  )

/** Plain, JSON-stable view of a result (functype Options don't snapshot cleanly). */
const summarize = (r: ScoreResult) => ({
  score: r.score,
  profile: r.profile,
  words: r.stats.words,
  dimensions: r.dimensions.map((d) => ({
    id: d.id,
    score: Number(d.score.toFixed(6)),
    weight: d.weight,
    skipped: d.skipped.isSome(),
    findings: d.findings.map((f) => ({
      rule: f.rule,
      severity: f.severity,
      hint: f.hint,
      excerpt: f.excerpt,
      line: f.loc.fold(
        () => null as number | null,
        (l) => l.line,
      ),
    })),
  })),
})

const CORPUS: ReadonlyArray<{ name: string; profile: string; format?: DocumentFormat }> = [
  { name: "good-readme.md", profile: "readme" },
  { name: "dense-academic.md", profile: "academic" },
  { name: "choppy-simplistic.md", profile: "blog" },
  { name: "plaintext-sample.txt", profile: "plain", format: "plaintext" },
]

describe("golden corpus", () => {
  for (const { name, profile, format } of CORPUS) {
    it(`scores ${name} against ${profile} deterministically`, () => {
      const raw = fixture(name)
      const a = summarize(score(raw, profile, format))
      const b = summarize(score(raw, profile, format))
      expect(a).toEqual(b)
      expect(a).toMatchSnapshot()
    })
  }

  it("orders the corpus sensibly: choppy and dense both score below the clean readme", () => {
    const readme = score(fixture("good-readme.md"), "readme").score
    const dense = score(fixture("dense-academic.md"), "readme").score
    const choppy = score(fixture("choppy-simplistic.md"), "readme").score
    expect(dense).toBeLessThan(readme)
    expect(choppy).toBeLessThan(readme)
  })
})
