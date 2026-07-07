import { parse } from "@prosemeter/core"
import type { DimensionResult, DimensionSettings, ParsedDocument, Severity } from "@prosemeter/core"
import { describe, expect, it } from "vitest"

import { gradeBandProvider } from "../src/grade-band"
import { sentenceComplexityProvider } from "../src/sentence-complexity"

const parseDoc = (raw: string): ParsedDocument =>
  parse(raw).fold(
    (err) => {
      throw new Error(`parse failed: ${err.kind}`)
    },
    (d) => d,
  )

const settings = (over: Partial<DimensionSettings> = {}): DimensionSettings => ({
  weight: 0.2,
  gradeBand: { lo: 8, hi: 12 },
  severities: new Map<string, Severity | "off">(),
  options: {},
  ...over,
})

const run = (provider: typeof gradeBandProvider, doc: ParsedDocument, s: DimensionSettings): DimensionResult =>
  provider.evaluate(doc, s).orThrow()

describe("grade-band", () => {
  it("skips documents shorter than 30 words", () => {
    const doc = parseDoc("# Hi\n\nToo short to score reliably here.\n")
    const result = run(gradeBandProvider, doc, settings())
    expect(result.skipped.isSome()).toBe(true)
    expect(result.findings).toHaveLength(0)
  })

  it("scores an in-band document near 1 and a dense one low", () => {
    const inBand = parseDoc(
      "# Guide\n\n" +
        "This tool reads your text and gives it a score. It also points out the parts that need work. " +
        "You can run it on any file. The output stays short so you can act on it quickly. It never guesses.\n",
    )
    const dense = parseDoc(
      "# Treatise\n\n" +
        "The epistemological ramifications of the aforementioned methodological framework necessitate " +
        "a comprehensive reconsideration of the underlying theoretical presuppositions insofar as the " +
        "multifaceted interdependencies engender profound reconceptualization of paradigmatic assumptions.\n",
    )
    const inBandScore = run(gradeBandProvider, inBand, settings()).score
    const denseScore = run(gradeBandProvider, dense, settings()).score
    expect(inBandScore).toBeGreaterThan(denseScore)
    expect(denseScore).toBeLessThan(0.5)
  })

  it("emits no findings (it is a document-level signal)", () => {
    const doc = parseDoc(
      "# Doc\n\nA reasonably sized paragraph of ordinary prose that carries enough words to be scored " +
        "by the readability formulas without tripping the short-document skip guard at all.\n",
    )
    expect(run(gradeBandProvider, doc, settings()).findings).toHaveLength(0)
  })
})

describe("sentence-complexity", () => {
  const hardDoc =
    "# Doc\n\nShort and clear.\n\n" +
    "The epistemological ramifications of the aforementioned methodological framework necessitate a " +
    "comprehensive reconsideration of the underlying theoretical presuppositions insofar as the multifaceted " +
    "interdependencies engender a profound reconceptualization of paradigmatic assumptions.\n"

  it("flags exactly the hard sentence, with an actionable hint and location", () => {
    const doc = parseDoc(hardDoc)
    const result = run(sentenceComplexityProvider, doc, settings({ weight: 0.1 }))
    expect(result.findings).toHaveLength(1)
    const [f] = result.findings
    expect(f?.rule).toBe("sentence-length")
    expect(f?.hint).toMatch(/^\d+ words, grade ~\d+ — split or simplify\.$/)
    expect(f?.excerpt.startsWith("The epistemological")).toBe(true)
    expect(f?.loc.isSome()).toBe(true)
    expect(
      f?.loc.fold(
        () => 0,
        (l) => l.line,
      ),
    ).toBeGreaterThan(1)
  })

  it("scores lower as more sentences are hard (density)", () => {
    const one = parseDoc(hardDoc)
    const two = parseDoc(hardDoc + "\n" + hardDoc.split("\n\n").slice(2).join("\n\n"))
    const s1 = run(sentenceComplexityProvider, one, settings({ weight: 0.1 })).score
    const s2 = run(sentenceComplexityProvider, two, settings({ weight: 0.1 })).score
    expect(s2).toBeLessThan(s1)
  })

  it("skips the dimension when its rule is turned off", () => {
    const doc = parseDoc(hardDoc)
    const off = settings({ weight: 0.1, severities: new Map<string, Severity | "off">([["sentence-length", "off"]]) })
    const result = run(sentenceComplexityProvider, doc, off)
    expect(result.skipped.isSome()).toBe(true)
    expect(result.findings).toHaveLength(0)
  })
})
