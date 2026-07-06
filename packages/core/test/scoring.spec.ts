import { None, Some } from "functype"
import { describe, expect, it } from "vitest"

import { band, composite, density, ratio } from "../src/scoring"
import type { DimensionResult } from "../src/types"

const dim = (id: string, score: number, weight: number, skipped = false): DimensionResult => ({
  id,
  score,
  weight,
  detail: "",
  findings: [],
  skipped: skipped ? Some("skipped") : None(),
})

describe("density", () => {
  it("is 1 for zero violations and for empty documents", () => {
    expect(density(0, 1000, 0.5)).toBe(1)
    expect(density(5, 0, 0.5)).toBe(1)
  })

  it("is monotone decreasing in violations", () => {
    const a = density(1, 1000, 0.5)
    const b = density(2, 1000, 0.5)
    const c = density(4, 1000, 0.5)
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(c)
    expect(a).toBeLessThan(1)
  })

  it("is length-fair: same violation count scores higher in a longer document", () => {
    expect(density(3, 2000, 0.5)).toBeGreaterThan(density(3, 500, 0.5))
  })
})

describe("band", () => {
  it("is exactly 1 inside the band (inclusive of edges)", () => {
    expect(band(8, 8, 12)).toBe(1)
    expect(band(10, 8, 12)).toBe(1)
    expect(band(12, 8, 12)).toBe(1)
  })

  it("is symmetric around the band for equal distances (bidirectional)", () => {
    for (const d of [1, 2, 3, 5]) {
      expect(band(8 - d, 8, 12)).toBeCloseTo(band(12 + d, 8, 12), 10)
    }
  })

  it("is monotone decreasing with distance from the band", () => {
    expect(band(7, 8, 12)).toBeGreaterThan(band(6, 8, 12))
    expect(band(6, 8, 12)).toBeGreaterThan(band(4, 8, 12))
    expect(band(13, 8, 12)).toBeGreaterThan(band(16, 8, 12))
  })

  it("stays within (0, 1]", () => {
    for (const v of [-10, 0, 5, 10, 20, 100]) {
      const s = band(v, 8, 12)
      expect(s).toBeGreaterThan(0)
      expect(s).toBeLessThanOrEqual(1)
    }
  })
})

describe("ratio", () => {
  it("clamps to [0, 1]", () => {
    expect(ratio(-0.5)).toBe(0)
    expect(ratio(0.42)).toBe(0.42)
    expect(ratio(1.7)).toBe(1)
  })
})

describe("composite", () => {
  it("is a weighted average scaled to 0–100", () => {
    expect(composite([dim("a", 1, 0.5), dim("b", 0, 0.5)])).toBe(50)
    expect(composite([dim("a", 0.8, 0.2), dim("b", 0.4, 0.1)])).toBe(Math.round(100 * ((0.2 * 0.8 + 0.1 * 0.4) / 0.3)))
  })

  it("stays within [0, 100] for arbitrary inputs", () => {
    for (const [s1, s2, w1, w2] of [
      [0, 0, 0.3, 0.7],
      [1, 1, 0.1, 0.9],
      [0.3, 0.9, 0.05, 0.02],
    ] as const) {
      const c = composite([dim("a", s1, w1), dim("b", s2, w2)])
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThanOrEqual(100)
    }
  })

  it("renormalizes: a skipped dimension does not change the composite", () => {
    const withoutSkipped = composite([dim("a", 0.9, 0.2), dim("b", 0.3, 0.1)])
    const withSkipped = composite([dim("a", 0.9, 0.2), dim("b", 0.3, 0.1), dim("c", 0, 0.4, true)])
    expect(withSkipped).toBe(withoutSkipped)
  })

  it("is 0 when every active dimension is skipped or weightless", () => {
    expect(composite([dim("a", 0.9, 0.5, true)])).toBe(0)
    expect(composite([dim("a", 0.9, 0)])).toBe(0)
  })
})
