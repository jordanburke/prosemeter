import { parse } from "@prosemeter/core"
import type { DimensionProvider, DimensionResult, DimensionSettings, ParsedDocument, Severity } from "@prosemeter/core"
import { describe, expect, it } from "vitest"

import { acronymDefinitionProvider } from "../src/acronym-definition"
import { lexicalDiversityProvider } from "../src/lexical-diversity"
import { mtld } from "../src/mtld"
import { spellingConsistencyProvider } from "../src/spelling-consistency"
import { terminologyConsistencyProvider } from "../src/terminology-consistency"

const doc = (raw: string): ParsedDocument =>
  parse(raw).fold(
    (err) => {
      throw new Error(`parse failed: ${err.kind}`)
    },
    (d) => d,
  )

const settings = (
  options: Readonly<Record<string, unknown>> = {},
  severities: ReadonlyArray<[string, Severity | "off"]> = [],
): DimensionSettings => ({
  weight: 0.05,
  gradeBand: { lo: 8, hi: 12 },
  severities: new Map(severities),
  options,
})

const run = (provider: DimensionProvider, raw: string, s: DimensionSettings = settings()): DimensionResult =>
  provider.evaluate(doc(raw), s).orThrow()

describe("mtld", () => {
  it("rates varied text above repetitive text", () => {
    const varied = "the quick brown fox jumps over a lazy dog while birds sing softly above green hills".split(" ")
    const repetitive = "the cat the cat the cat the cat the cat the cat the cat the cat the cat the cat".split(" ")
    expect(mtld(varied)).toBeGreaterThan(mtld(repetitive))
  })
})

describe("lexical-diversity", () => {
  it("skips documents under 100 words", () => {
    expect(run(lexicalDiversityProvider, "# T\n\nShort document with few words here.\n").skipped.isSome()).toBe(true)
  })
})

describe("terminology-consistency", () => {
  it("flags brand case variants", () => {
    const result = run(
      terminologyConsistencyProvider,
      "# G\n\nWe use GitHub daily. Github is fine. We prefer GitHub overall.\n",
    )
    expect(result.findings.some((f) => f.excerpt === "Github")).toBe(true)
  })

  it("applies a configured term map", () => {
    const result = run(
      terminologyConsistencyProvider,
      "# T\n\nOur frontend calls the backend service every second.\n",
      settings({ terms: { "front-end": ["frontend"] } }),
    )
    expect(result.findings.some((f) => f.excerpt === "frontend")).toBe(true)
  })
})

describe("acronym-definition", () => {
  it("flags an acronym used without a definition", () => {
    const result = run(acronymDefinitionProvider, "# T\n\nThe FBO handles requests and the WXY subsystem logs them.\n")
    expect(result.findings.map((f) => f.excerpt).sort()).toEqual(["FBO", "WXY"])
    expect(result.score).toBe(0)
  })

  it("counts an acronym as defined when it appears parenthetically", () => {
    const result = run(
      acronymDefinitionProvider,
      "# T\n\nThe Federal Business Office (FBO) processes forms with the FBO daily.\n",
    )
    expect(result.findings).toHaveLength(0)
    expect(result.score).toBe(1)
  })

  it("ignores allowlisted acronyms like API and JSON", () => {
    const result = run(
      acronymDefinitionProvider,
      "# T\n\nThe API returns JSON to the client on every request without fail.\n",
    )
    expect(result.findings).toHaveLength(0)
  })
})

describe("spelling-consistency", () => {
  it("flags the minority variant when US and UK spellings mix", () => {
    const result = run(
      spellingConsistencyProvider,
      "# T\n\nWe use color and color and color everywhere, but one file has colour in it.\n",
    )
    expect(result.findings.map((f) => f.excerpt)).toEqual(["colour"])
  })
})
