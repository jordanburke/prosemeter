import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import type { DocumentFormat } from "@prosemeter/core"
import { describe, expect, it } from "vitest"

import { score } from "../src/index"

/**
 * Calibration regression guard. The k / kb / band constants across the scorer packages were tuned so
 * the golden corpus lands in intuitive ranges; these assertions freeze that so a future constant
 * change that breaks the ordering fails loudly. Absolute magnitudes are deliberately loose — the
 * relative ordering and the "a clean README scores well" floor are what matter.
 */

const scoreFixture = (name: string, profile: string, format: DocumentFormat): number => {
  const raw = readFileSync(fileURLToPath(new URL(`../../../fixtures/${name}`, import.meta.url)), "utf8")
  return score(raw, { profile, format, target: name }).fold(
    (err) => {
      throw new Error(`score failed for ${name}: ${JSON.stringify(err)}`)
    },
    (r) => r.score,
  )
}

describe("golden corpus calibration", () => {
  const goodReadme = () => scoreFixture("good-readme.md", "readme", "markdown")
  const wallOfText = () => scoreFixture("wall-of-text.md", "readme", "markdown")
  const denseAcademic = () => scoreFixture("dense-academic.md", "academic", "markdown")
  const plaintext = () => scoreFixture("plaintext-sample.txt", "plain", "plaintext")

  it("scores a clean README well above the readme threshold", () => {
    expect(goodReadme()).toBeGreaterThanOrEqual(85)
  })

  it("scores clean prose highly", () => {
    expect(plaintext()).toBeGreaterThanOrEqual(70)
  })

  it("ranks the clean README above the poorly-written documents", () => {
    const good = goodReadme()
    expect(good).toBeGreaterThan(wallOfText())
    expect(good).toBeGreaterThan(denseAcademic())
  })

  it("keeps the wall-of-text clearly in the lower range", () => {
    expect(wallOfText()).toBeLessThan(70)
  })
})

/**
 * The `chat` profile exists to be a dependent variable: hold the task fixed, vary the instructions
 * given to an agent, and read the score. That only works if the profile separates registers well and
 * cannot be bought cheaply, so both properties are frozen here. The two chat fixtures are the same
 * answer to the same question written two ways, so the spread is attributable to register alone.
 */
describe("chat profile calibration", () => {
  const chatClear = () => scoreFixture("chat-clear.md", "chat", "markdown")
  const chatJargon = () => scoreFixture("chat-jargon.md", "chat", "markdown")
  const choppy = () => scoreFixture("choppy-simplistic.md", "chat", "markdown")

  it("scores a clear reply above the profile threshold of 75", () => {
    expect(chatClear()).toBeGreaterThanOrEqual(80)
  })

  it("separates the two registers by a wide margin", () => {
    expect(chatClear() - chatJargon()).toBeGreaterThan(30)
  })

  it("does not let telegraphic prose buy a passing score", () => {
    // The grade band floors at 7 as well as capping at 12, so chopping every sentence short lands
    // below the band and is penalized. Without this, "be concise" instructions would score as wins.
    expect(choppy()).toBeLessThan(75)
  })
})
