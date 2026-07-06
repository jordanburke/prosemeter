/**
 * @prosemeter/style — style dimensions: passive-voice, clarity, hedging, redundancy, and
 * sentence-variety. Style rules come from retext plugins (doctrine rule 2); clichés are an in-house
 * word list because the community plugin is unmaintained. `styleProviders` is what the bundle
 * registers.
 */

import type { DimensionProvider } from "@prosemeter/core"

import { clarityProvider } from "./clarity"
import { hedgingProvider } from "./hedging"
import { passiveVoiceProvider } from "./passive-voice"
import { redundancyProvider } from "./redundancy"
import { sentenceVarietyProvider } from "./sentence-variety"

export { clarityProvider } from "./clarity"
export { CLICHES, findCliches } from "./cliches"
export { hedgingProvider } from "./hedging"
export { passiveVoiceProvider } from "./passive-voice"
export { redundancyProvider } from "./redundancy"
export { sentenceVarietyProvider } from "./sentence-variety"

export const styleProviders: ReadonlyArray<DimensionProvider> = [
  passiveVoiceProvider,
  clarityProvider,
  hedgingProvider,
  redundancyProvider,
  sentenceVarietyProvider,
]
