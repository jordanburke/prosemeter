import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { runCli } from "../src/cli/run"

const fixture = (name: string): string => fileURLToPath(new URL(`../../../fixtures/${name}`, import.meta.url))

type Captured = { code: number; out: string; err: string }

const capture = async (argv: ReadonlyArray<string>): Promise<Captured> => {
  const out: Array<string> = []
  const errs: Array<string> = []
  const origOut = process.stdout.write
  const origErr = process.stderr.write
  process.stdout.write = ((s: string | Uint8Array) => {
    out.push(String(s))
    return true
  }) as unknown as typeof process.stdout.write
  process.stderr.write = ((s: string | Uint8Array) => {
    errs.push(String(s))
    return true
  }) as unknown as typeof process.stderr.write
  try {
    const code = await runCli(argv)
    return { code, out: out.join(""), err: errs.join("") }
  } finally {
    process.stdout.write = origOut
    process.stderr.write = origErr
  }
}

describe("prosemeter CLI", () => {
  it("lists profiles", async () => {
    const { code, out } = await capture(["profiles"])
    expect(code).toBe(0)
    expect(out).toContain("readme")
    expect(out).toContain("academic")
  })

  it("prints --version and --help", async () => {
    expect((await capture(["--version"])).code).toBe(0)
    expect((await capture(["--help"])).out).toContain("Usage:")
  })

  it("scores a file to human output with a dimension table and findings", async () => {
    const { code, out } = await capture(["score", fixture("dense-academic.md"), "--profile", "readme"])
    expect(code).toBe(0)
    expect(out).toMatch(/\/100/)
    expect(out).toContain("Dimensions")
    expect(out).toContain("split or simplify")
  })

  it("emits a valid ScoreResult JSON with --json", async () => {
    const { code, out } = await capture(["score", fixture("good-readme.md"), "--profile", "readme", "--json"])
    expect(code).toBe(0)
    const parsed = JSON.parse(out) as { score: number; dimensions: ReadonlyArray<{ id: string }>; version: string }
    expect(typeof parsed.score).toBe("number")
    expect(parsed.dimensions.map((d) => d.id)).toContain("grade-band")
    expect(parsed.version).toBeTruthy()
  })

  it("exits 0 above threshold and 1 below", async () => {
    expect((await capture(["score", fixture("good-readme.md"), "--profile", "readme", "--threshold", "20"])).code).toBe(
      0,
    )
    expect(
      (await capture(["score", fixture("dense-academic.md"), "--profile", "readme", "--threshold", "90"])).code,
    ).toBe(1)
  })

  it("exits 2 for a missing file, unknown profile, unknown flag, and no input", async () => {
    expect((await capture(["score", fixture("does-not-exist.md")])).code).toBe(2)
    const badProfile = await capture(["score", fixture("good-readme.md"), "--profile", "nope"])
    expect(badProfile.code).toBe(2)
    expect(badProfile.err).toContain("is not a known profile")
    expect((await capture(["score", fixture("good-readme.md"), "--nope"])).code).toBe(2)
    expect((await capture(["score"])).code).toBe(2)
  })

  it("reports a mean across multiple files", async () => {
    const { code, out } = await capture([
      "score",
      fixture("good-readme.md"),
      fixture("dense-academic.md"),
      "--profile",
      "readme",
    ])
    expect(code).toBe(0)
    expect(out).toMatch(/Mean: \d+\/100 across 2 files/)
  })
})

describe("prosemeter CLI — baseline loop", () => {
  let dir: string
  let draft: string
  let baseline: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "pm-cli-baseline-"))
    draft = join(dir, "draft.md")
    baseline = join(dir, ".prosemeter", "baseline.json")
  })
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  type LoopJSON = {
    score: number
    delta?: { scoreDelta: number; verdict: string; findingsResolved: ReadonlyArray<unknown> }
    convergence?: { verdict: string; history: ReadonlyArray<number> }
  }

  const HARD =
    "# Doc\n\nThe epistemological ramifications of the aforementioned methodological framework necessitate a " +
    "comprehensive reconsideration of the underlying theoretical presuppositions insofar as interdependencies engender.\n"
  const EASY =
    "# Doc\n\nThis tool reads text. It gives a score. It tells you what to fix. You act on it. Then you run again.\n"

  it("saves history, then diffs and reports convergence on the next run", async () => {
    writeFileSync(draft, HARD)
    const first = await capture([
      "score",
      draft,
      "--profile",
      "plain",
      "--save-baseline",
      "--baseline-file",
      baseline,
      "--json",
    ])
    expect(first.code).toBe(0)
    const firstJson = JSON.parse(first.out) as LoopJSON
    expect(firstJson.convergence?.history).toEqual([firstJson.score])
    expect(firstJson.delta).toBeUndefined() // no prior baseline to diff against yet

    writeFileSync(draft, EASY)
    const second = await capture([
      "score",
      draft,
      "--profile",
      "plain",
      "--baseline",
      "--save-baseline",
      "--baseline-file",
      baseline,
      "--json",
    ])
    expect(second.code).toBe(0)
    const secondJson = JSON.parse(second.out) as LoopJSON
    expect(secondJson.delta?.verdict).toBe("improved")
    expect(secondJson.delta?.scoreDelta).toBeGreaterThan(0)
    expect(secondJson.delta?.findingsResolved.length).toBeGreaterThan(0)
    expect(secondJson.convergence?.history).toEqual([firstJson.score, secondJson.score])
  })

  it("rejects baseline operations across multiple targets", async () => {
    writeFileSync(draft, EASY)
    const other = join(dir, "other.md")
    writeFileSync(other, EASY)
    const { code, err } = await capture(["score", draft, other, "--baseline", "--baseline-file", baseline])
    expect(code).toBe(2)
    expect(err).toContain("single target")
  })

  it("exits 2 on a malformed baseline file", async () => {
    writeFileSync(draft, EASY)
    const badBaseline = join(dir, "bad.json")
    writeFileSync(badBaseline, "{ not valid json ")
    const { code } = await capture(["score", draft, "--baseline", "--baseline-file", badBaseline])
    expect(code).toBe(2)
  })
})
