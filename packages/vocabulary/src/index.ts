/**
 * @prosemeter/vocabulary — lexical-diversity (MTLD), terminology-consistency, acronym-definition,
 * and spelling-consistency. `vocabularyProviders` is what the bundle registers.
 */

import type { DimensionProvider } from "@prosemeter/core"

import { acronymDefinitionProvider } from "./acronym-definition"
import { lexicalDiversityProvider } from "./lexical-diversity"
import { spellingConsistencyProvider } from "./spelling-consistency"
import { terminologyConsistencyProvider } from "./terminology-consistency"

export { acronymDefinitionProvider } from "./acronym-definition"
export { lexicalDiversityProvider } from "./lexical-diversity"
export { mtld } from "./mtld"
export { spellingConsistencyProvider } from "./spelling-consistency"
export { terminologyConsistencyProvider } from "./terminology-consistency"
export { ACRONYM_ALLOWLIST, US_UK_PAIRS } from "./wordlists"

export const vocabularyProviders: ReadonlyArray<DimensionProvider> = [
  lexicalDiversityProvider,
  terminologyConsistencyProvider,
  acronymDefinitionProvider,
  spellingConsistencyProvider,
]
