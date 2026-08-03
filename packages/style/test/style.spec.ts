import { parse } from "@prosemeter/core"
import type { DimensionProvider, DimensionResult, DimensionSettings, ParsedDocument, Severity } from "@prosemeter/core"
import { describe, expect, it } from "vitest"

import { findCliches } from "../src/cliches"
import { clarityProvider } from "../src/clarity"
import { directnessProvider } from "../src/directness"
import { activeVoiceProvider } from "../src/active-voice"
import { concisionProvider } from "../src/concision"
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

describe("directness (retext-intensify)", () => {
  it("flags weasel words", () => {
    const result = run(
      directnessProvider,
      "# T\n\nThis is very clearly a great many things that some people believe.\n",
    )
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.findings.every((f) => f.rule === "retext-intensify")).toBe(true)
  })

  /**
   * retext-intensify matches on the word alone, so its `weasels` list flags ordinary grammar and
   * plain verbs. Left unfiltered the dimension ran backwards on the calibration fixtures — it
   * scored chat-jargon above chat-clear. These lock in the filter and the signal it must keep.
   */
  it("ignores grammar and plain verbs that are not hedges in technical prose", () => {
    const raw =
      "# T\n\nThe resolver picks that version, so the other package still works. " +
      "Back up your own copy and it helps.\n"
    expect(run(directnessProvider, raw).findings).toHaveLength(0)
  })

  it("still flags genuine hedges after filtering", () => {
    const raw = "# T\n\nThis probably seems relatively useful and might arguably be several things.\n"
    expect(run(directnessProvider, raw).findings.length).toBeGreaterThan(0)
  })

  it("accepts extra ignores from dimensionOptions and can drop the defaults", () => {
    const raw = "# T\n\nThe package still works and it probably helps.\n"
    const withExtra = run(directnessProvider, raw, { ...settings(), options: { ignore: ["probably"] } })
    expect(withExtra.findings).toHaveLength(0)

    const withoutDefaults = run(directnessProvider, raw, { ...settings(), options: { useDefaultIgnore: false } })
    expect(withoutDefaults.findings.length).toBeGreaterThan(0)
  })
})

describe("active-voice (retext-passive)", () => {
  it("scores a passive-free document at 1", () => {
    const result = run(
      activeVoiceProvider,
      "# T\n\nThe team shipped the release. Everyone celebrated the win together.\n",
    )
    expect(result.score).toBe(1)
  })
})

describe("concision", () => {
  it("catches repeated words, redundant acronyms, and clichés", () => {
    const result = run(
      concisionProvider,
      "# T\n\nThe the plan uses an ATM machine. At the end of the day we ship it.\n",
    )
    const rules = new Set(result.findings.map((f) => f.rule))
    expect(rules.has("retext-repeated-words")).toBe(true)
    expect(rules.has("retext-redundant-acronyms")).toBe(true)
    expect(rules.has("cliches")).toBe(true)
  })

  it("is skipped only when all three concision rules are off", () => {
    const off = settings([
      ["retext-repeated-words", "off"],
      ["retext-redundant-acronyms", "off"],
      ["cliches", "off"],
    ])
    expect(run(concisionProvider, "The the plan.", off).skipped.isSome()).toBe(true)
  })
})

describe("cliches (in-house)", () => {
  it("detects a cliché at its sentence location", () => {
    const findings = findCliches(doc("# T\n\nAt the end of the day, we must move the needle.\n"), "concision", "warn")
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
