import { parse } from "@prosemeter/core"
import type { DimensionProvider, DimensionResult, DimensionSettings, ParsedDocument, Severity } from "@prosemeter/core"
import { describe, expect, it } from "vitest"

import { findCliches } from "../src/cliches"
import { clarityProvider } from "../src/clarity"
import { hedgingProvider } from "../src/hedging"
import { passiveVoiceProvider } from "../src/passive-voice"
import { redundancyProvider } from "../src/redundancy"
import { sentenceVarietyProvider } from "../src/sentence-variety"

const doc = (raw: string): ParsedDocument =>
  parse(raw).fold(
    (err) => {
      throw new Error(`parse failed: ${err.kind}`)
    },
    (d) => d,
  )

const settings = (severities: ReadonlyArray<[string, Severity | "off"]> = []): DimensionSettings => ({
  weight: 0.1,
  gradeBand: { lo: 8, hi: 12 },
  severities: new Map(severities),
  options: {},
})

const run = (provider: DimensionProvider, raw: string, s: DimensionSettings = settings()): DimensionResult =>
  provider.evaluate(doc(raw), s).orThrow()

describe("clarity (retext-simplify)", () => {
  it("flags wordy phrases and folds the simpler alternative into the hint", () => {
    const result = run(clarityProvider, "# T\n\nWe utilize a great deal of resources in order to succeed here.\n")
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.findings.some((f) => f.hint.includes('"use"'))).toBe(true)
    expect(result.score).toBeLessThan(1)
  })

  it("is skipped when its rule is off", () => {
    const result = run(clarityProvider, "We utilize resources.", settings([["retext-simplify", "off"]]))
    expect(result.skipped.isSome()).toBe(true)
    expect(result.findings).toHaveLength(0)
  })
})

describe("hedging (retext-intensify)", () => {
  it("flags weasel words", () => {
    const result = run(hedgingProvider, "# T\n\nThis is very clearly a great many things that some people believe.\n")
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.findings.every((f) => f.rule === "retext-intensify")).toBe(true)
  })
})

describe("passive-voice (retext-passive)", () => {
  it("scores a passive-free document at 1", () => {
    const result = run(
      passiveVoiceProvider,
      "# T\n\nThe team shipped the release. Everyone celebrated the win together.\n",
    )
    expect(result.score).toBe(1)
  })
})

describe("redundancy", () => {
  it("catches repeated words, redundant acronyms, and clichés", () => {
    const result = run(
      redundancyProvider,
      "# T\n\nThe the plan uses an ATM machine. At the end of the day we ship it.\n",
    )
    const rules = new Set(result.findings.map((f) => f.rule))
    expect(rules.has("retext-repeated-words")).toBe(true)
    expect(rules.has("retext-redundant-acronyms")).toBe(true)
    expect(rules.has("cliches")).toBe(true)
  })

  it("is skipped only when all three redundancy rules are off", () => {
    const off = settings([
      ["retext-repeated-words", "off"],
      ["retext-redundant-acronyms", "off"],
      ["cliches", "off"],
    ])
    expect(run(redundancyProvider, "The the plan.", off).skipped.isSome()).toBe(true)
  })
})

describe("cliches (in-house)", () => {
  it("detects a cliché at its sentence location", () => {
    const findings = findCliches(doc("# T\n\nAt the end of the day, we must move the needle.\n"), "redundancy", "warn")
    expect(findings.map((f) => f.excerpt).sort()).toEqual(["at the end of the day", "move the needle"])
    expect(findings[0]?.loc.isSome()).toBe(true)
  })
})

describe("sentence-variety", () => {
  it("flags a run of same-length sentences", () => {
    const result = run(
      sentenceVarietyProvider,
      "The team ships fast. The team writes docs. The team fixes bugs. The team helps users. The team learns daily.",
    )
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.findings[0]?.rule).toBe("sentence-variety")
  })

  it("is skipped for documents with too few sentences", () => {
    expect(run(sentenceVarietyProvider, "# T\n\nOne single sentence here.\n").skipped.isSome()).toBe(true)
  })
})
