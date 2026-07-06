import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

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
