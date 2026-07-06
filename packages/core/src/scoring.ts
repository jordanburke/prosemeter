/**
 * The three normalization strategies and the composite.
 *
 * Every dimension maps a raw signal to a 0–1 score with one of these. The composite is a weighted
 * average over the *active* (non-skipped) dimensions — skipped weight redistributes automatically,
 * so the composite stays a proper weighted average (functype-eval's renormalization).
 */

import type { DimensionResult } from "./types"

/**
 * Density — for count-based dimensions (style lint, some structure/vocab).
 * `score = 1 / (1 + (violations / KW) * k)`, `KW = words / 1000`. Length-fair: lint rules report
 * counts, not opportunity denominators, so we normalize by document length. Monotone decreasing in
 * violations; a violation-free document scores exactly 1.
 */
export const density = (violations: number, words: number, k: number): number => {
  const kw = words / 1000
  if (kw <= 0) return 1
  return 1 / (1 + (violations / kw) * k)
}

/**
 * Band — for target-range dimensions (readability grade, variance, structure ratios).
 * Inside `[lo, hi]` → 1; outside → `1 / (1 + d² × kb)` where `d` is the distance to the nearest band
 * edge. Bidirectional by design: a document can be too complex *or* too simplistic.
 */
export const band = (value: number, lo: number, hi: number, kb = 0.5): number => {
  if (value >= lo && value <= hi) return 1
  const d = value < lo ? lo - value : value - hi
  return 1 / (1 + d * d * kb)
}

/** Ratio — for native-proportion dimensions. The ratio is the score; clamped to [0, 1]. */
export const ratio = (value: number): number => Math.max(0, Math.min(1, value))

/**
 * Composite fitness, 0–100 (rounded). A weighted average over the active dimensions, with weights
 * renormalized by the active-weight sum so skipping a dimension never distorts the others.
 */
export const composite = (dimensions: ReadonlyArray<DimensionResult>): number => {
  const active = dimensions.filter((d) => d.skipped.isNone())
  const totalWeight = active.reduce((sum, d) => sum + d.weight, 0)
  if (totalWeight <= 0) return 0
  const weighted = active.reduce((sum, d) => sum + (d.weight / totalWeight) * d.score, 0)
  return Math.round(100 * weighted)
}
