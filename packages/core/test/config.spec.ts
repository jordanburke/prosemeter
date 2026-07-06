import { describe, expect, it } from "vitest"

import type { ConfigError, ResolvedConfig } from "../src/config"
import { resolveConfig } from "../src/config"

const right = (e: ReturnType<typeof resolveConfig>): ResolvedConfig =>
  e.fold(
    (errs) => {
      throw new Error(
        `expected Right, got errors: ${errs
          .toArray()
          .map((x) => x.message)
          .join("; ")}`,
      )
    },
    (v) => v,
  )

const leftFields = (e: ReturnType<typeof resolveConfig>): ReadonlyArray<string> =>
  e.fold(
    (errs) => errs.toArray().map((x: ConfigError) => x.context.field),
    () => {
      throw new Error("expected Left")
    },
  )

describe("resolveConfig", () => {
  it("resolves a built-in profile", () => {
    const c = right(resolveConfig("readme"))
    expect(c.profile).toBe("readme")
    expect(c.gradeBand).toEqual({ lo: 8, hi: 12 })
    expect(c.threshold).toBe(75)
  })

  it("defaults to plain", () => {
    expect(right(resolveConfig()).profile).toBe("plain")
  })

  it("resolves via extends and applies overrides", () => {
    const c = right(resolveConfig(undefined, { extends: "blog", gradeBand: { hi: 11 }, threshold: 80 }))
    expect(c.profile).toBe("blog")
    expect(c.gradeBand).toEqual({ lo: 7, hi: 11 })
    expect(c.threshold).toBe(80)
  })

  it("rejects an unknown profile with a typed validation error", () => {
    const result = resolveConfig("nope")
    expect(leftFields(result)).toContain("profile")
    result.fold(
      (errs) => {
        const first = errs.toArray()[0]
        expect(first?.code).toBe("VALIDATION_FAILED")
        expect(first?.message).toMatch(/^Validation failed:/)
      },
      () => {
        throw new Error("expected Left")
      },
    )
  })

  it("accumulates every validation error at once", () => {
    const fields = leftFields(
      resolveConfig("plain", {
        gradeBand: { lo: 15, hi: 10 },
        weights: { "grade-band": -1 },
        rules: { "retext-passive": "loud" as never },
        threshold: 150,
      }),
    )
    expect(fields).toContain("gradeBand")
    expect(fields).toContain("weights.grade-band")
    expect(fields).toContain("rules.retext-passive")
    expect(fields).toContain("threshold")
    expect(fields.length).toBeGreaterThanOrEqual(4)
  })
})
