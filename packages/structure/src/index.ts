/**
 * @prosemeter/structure — markdown-aware document-structure dimensions: heading-hierarchy,
 * section-length, paragraph-length, and document-balance. All auto-skip for plaintext, where
 * structure is not meaningful. `structureProviders` is what the bundle registers.
 */

import type { DimensionProvider } from "@prosemeter/core"

import { documentBalanceProvider } from "./document-balance"
import { headingHierarchyProvider } from "./heading-hierarchy"
import { paragraphLengthProvider } from "./paragraph-length"
import { sectionLengthProvider } from "./section-length"

export { documentBalanceProvider } from "./document-balance"
export { headingHierarchyProvider } from "./heading-hierarchy"
export { paragraphLengthProvider } from "./paragraph-length"
export { sectionLengthProvider } from "./section-length"
export type { Section } from "./sections"
export { sections } from "./sections"

export const structureProviders: ReadonlyArray<DimensionProvider> = [
  headingHierarchyProvider,
  sectionLengthProvider,
  paragraphLengthProvider,
  documentBalanceProvider,
]
