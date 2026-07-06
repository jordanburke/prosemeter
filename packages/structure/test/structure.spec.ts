import { parse } from "@prosemeter/core"
import type {
  DimensionProvider,
  DimensionResult,
  DimensionSettings,
  DocumentFormat,
  ParsedDocument,
  Severity,
} from "@prosemeter/core"
import { describe, expect, it } from "vitest"

import { documentBalanceProvider } from "../src/document-balance"
import { headingHierarchyProvider } from "../src/heading-hierarchy"
import { paragraphLengthProvider } from "../src/paragraph-length"
import { sectionLengthProvider } from "../src/section-length"
import { sections } from "../src/sections"

const doc = (raw: string, format: DocumentFormat = "markdown"): ParsedDocument =>
  parse(raw, format).fold(
    (err) => {
      throw new Error(`parse failed: ${err.kind}`)
    },
    (d) => d,
  )

const settings = (
  options: Readonly<Record<string, unknown>> = {},
  severities: ReadonlyArray<[string, Severity | "off"]> = [],
): DimensionSettings => ({
  weight: 0.06,
  gradeBand: { lo: 8, hi: 12 },
  severities: new Map(severities),
  options,
})

const run = (provider: DimensionProvider, d: ParsedDocument, s: DimensionSettings = settings()): DimensionResult =>
  provider.evaluate(d, s).orThrow()

describe("sections", () => {
  it("splits by heading and counts words, lists, and code", () => {
    const secs = sections(
      doc("# A\n\nOne two three.\n\n- item\n- item\n\n## B\n\n```js\nx\n```\n\nMore words here now.\n").mdast,
    )
    expect(secs).toHaveLength(2)
    expect(secs[0]?.listItems).toBe(2)
    expect(secs[1]?.codeBlocks).toBe(1)
  })
})

describe("heading-hierarchy", () => {
  it("flags multiple H1s and skipped levels", () => {
    const result = run(headingHierarchyProvider, doc("# One\n\nText.\n\n# Two\n\nText.\n\n### Jump\n\nText.\n"))
    const messages = result.findings.map((f) => f.message).join(" ")
    expect(messages).toContain("Multiple H1")
    expect(messages).toContain("jumps from h1 to h3")
  })

  it("flags bold text used as a heading", () => {
    const result = run(headingHierarchyProvider, doc("# Title\n\n**Not a heading**\n\nBody text here.\n"))
    expect(result.findings.some((f) => f.message.includes("Bold text"))).toBe(true)
  })

  it("skips plaintext", () => {
    expect(
      run(headingHierarchyProvider, doc("Just prose, no headings at all here.", "plaintext")).skipped.isSome(),
    ).toBe(true)
  })
})

describe("section-length", () => {
  it("flags a wall-of-text section over the band", () => {
    const wall = `# Title\n\n${"word ".repeat(600)}\n`
    const result = run(sectionLengthProvider, doc(wall), settings({ lo: 40, hi: 400 }))
    expect(result.findings.some((f) => f.message.includes("Wall of text"))).toBe(true)
    expect(result.score).toBeLessThan(1)
  })

  it("scores well-sized sections near 1", () => {
    const ok = `# A\n\n${"word ".repeat(120)}\n\n## B\n\n${"word ".repeat(120)}\n`
    expect(run(sectionLengthProvider, doc(ok), settings({ lo: 40, hi: 400 })).score).toBeGreaterThan(0.9)
  })
})

describe("paragraph-length", () => {
  it("flags a paragraph over the split threshold", () => {
    const longPara = `# T\n\n${"This is a sentence. ".repeat(12)}\n`
    const result = run(paragraphLengthProvider, doc(longPara))
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.findings[0]?.hint).toContain("Split")
  })
})

describe("document-balance", () => {
  it("flags excessive link density", () => {
    const links = Array.from({ length: 20 }, (_, i) => `[l${i}](https://e.com/${i})`).join(" ")
    const result = run(
      documentBalanceProvider,
      doc(`# T\n\n${links} and a few words.\n`),
      settings({ maxLinksPer1000: 40 }),
    )
    expect(result.findings.some((f) => f.message.includes("link density"))).toBe(true)
  })
})
