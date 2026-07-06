import { describe, expect, it } from "vitest"

import { parse } from "../src/parse"
import type { ParseError, ParsedDocument } from "../src/types"

const doc = (raw: string): ParsedDocument =>
  parse(raw).fold(
    (err) => {
      throw new Error(`expected parse success, got ${err.kind}`)
    },
    (d) => d,
  )

const err = (raw: string): ParseError =>
  parse(raw).fold(
    (e) => e,
    () => {
      throw new Error("expected parse failure")
    },
  )

describe("parse", () => {
  it("counts prose and extracts structure", () => {
    const d = doc("# Title\n\nThis is a sentence with several words in it. And a second one here.\n")
    expect(d.stats.words).toBeGreaterThan(10)
    expect(d.stats.sentences).toBeGreaterThanOrEqual(2)
    expect(d.stats.headings).toHaveLength(1)
    expect(d.stats.headings[0]?.text).toBe("Title")
    expect(d.stats.headings[0]?.line).toBe(1)
  })

  it("excludes code blocks and URLs from prose but counts them in stats", () => {
    const d = doc(
      "Some real prose here about things.\n\n```js\nconst secret = 1\n```\n\nSee [docs](https://example.com/page).\n",
    )
    expect(d.stats.codeBlocks).toBe(1)
    expect(d.stats.links).toBe(1)
    expect(d.plaintext).not.toContain("secret")
    expect(d.plaintext).not.toContain("example.com")
    expect(d.plaintext).toContain("docs")
  })

  it("rejects empty and whitespace-only input", () => {
    expect(err("").kind).toBe("empty")
    expect(err("   \n\t  ").kind).toBe("empty")
  })

  it("rejects prose-free input distinctly", () => {
    expect(err("```js\nconst x = 1\n```").kind).toBe("no-prose")
  })

  it("is deterministic", () => {
    const raw = "# H\n\nRepeatable prose that should parse to the same stats every time.\n"
    expect(doc(raw).stats).toEqual(doc(raw).stats)
  })
})
