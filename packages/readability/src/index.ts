/**
 * @prosemeter/readability — grade-level readability dimensions. Two `DimensionProvider`s (grade-band
 * and sentence-complexity) plus a `readabilityProviders` array the bundle registers.
 */

import type { DimensionProvider } from "@prosemeter/core"

import { gradeBandProvider } from "./grade-band"
import { sentenceComplexityProvider } from "./sentence-complexity"

export type { Counts, GradeBreakdown } from "./formulas"
export { gradeBreakdown } from "./formulas"
export { gradeBandProvider } from "./grade-band"
export { sentenceComplexityProvider } from "./sentence-complexity"

export const readabilityProviders: ReadonlyArray<DimensionProvider> = [gradeBandProvider, sentenceComplexityProvider]
