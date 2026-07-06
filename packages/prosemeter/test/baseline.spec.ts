import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { BaselineFile } from "../src/baseline"
import { loadBaseline, saveBaseline } from "../src/baseline"
import { compareBaseline, fromScoreResultJSON, score, toScoreResultJSON } from "../src/index"

const scored = (text: string) =>
  score(text, { profile: "plain", target: "draft" }).fold(
    (err) => {
      throw new Error(`score failed: ${JSON.stringify(err)}`)
    },
    (r) => r,
  )

const HARD =
  "# Doc\n\nThe epistemological ramifications of the aforementioned methodological framework necessitate a " +
  "comprehensive reconsideration of the underlying theoretical presuppositions insofar as the interdependencies engender.\n"
const EASY =
  "# Doc\n\nThis tool reads text. It gives a score. It tells you what to fix. You act on it. Then you run it again.\n"

describe("baseline persistence", () => {
  let dir: string
  let path: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pm-baseline-"))
    path = join(dir, "sub", "baseline.json")
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it("returns undefined for a missing baseline", () => {
    expect(loadBaseline(path)).toBeUndefined()
  })

  it("creates nested dirs and appends score history across saves", () => {
    const first = saveBaseline(path, scored(HARD), [])
    expect(first.history).toHaveLength(1)

    const reloaded = loadBaseline(path) as BaselineFile
    expect(reloaded.history).toEqual(first.history)

    const second = saveBaseline(path, scored(EASY), reloaded.history)
    expect(second.history).toEqual([first.history[0], scored(EASY).score])

    const onDisk = JSON.parse(readFileSync(path, "utf8")) as BaselineFile
    expect(onDisk.history).toHaveLength(2)
    expect(onDisk.result.score).toBe(scored(EASY).score)
  })
})

describe("JSON round-trip preserves finding identity for diffing", () => {
  it("compareBaseline over a rehydrated result matches the live result", () => {
    const hard = scored(HARD)
    const easy = scored(EASY)
    const rehydratedHard = fromScoreResultJSON(toScoreResultJSON(hard))

    const liveDelta = compareBaseline(easy, hard)
    const roundTripDelta = compareBaseline(easy, rehydratedHard)

    expect(roundTripDelta.scoreDelta).toBe(liveDelta.scoreDelta)
    expect(roundTripDelta.findingsResolved.map((f) => f.excerpt)).toEqual(
      liveDelta.findingsResolved.map((f) => f.excerpt),
    )
    expect(roundTripDelta.findingsNew.map((f) => f.excerpt)).toEqual(liveDelta.findingsNew.map((f) => f.excerpt))
  })
})
