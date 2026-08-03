/**
 * @prosemeter/readability — grade-level readability dimensions. Two `DimensionProvider`s (grade-band
 * and sentence-simplicity) plus a `readabilityProviders` array the bundle registers.
 */

import type { DimensionProvider } from "@prosemeter/core"

import { gradeBandProvider } from "./grade-band"
import { sentenceSimplicityProvider } from "./sentence-simplicity"

export type { Counts, GradeBreakdown } from "./formulas"
export { gradeBreakdown } from "./formulas"
export { gradeBandProvider } from "./grade-band"
export { sentenceSimplicityProvider } from "./sentence-simplicity"

export const readabilityProviders: ReadonlyArray<DimensionProvider> = [gradeBandProvider, sentenceSimplicityProvider]
