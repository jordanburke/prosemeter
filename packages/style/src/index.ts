/**
 * @prosemeter/style — style dimensions: active-voice, clarity, directness, concision, and
 * sentence-variety. Style rules come from retext plugins (doctrine rule 2); clichés are an in-house
 * word list because the community plugin is unmaintained. `styleProviders` is what the bundle
 * registers.
 */

import type { DimensionProvider } from "@prosemeter/core"

import { activeVoiceProvider } from "./active-voice"
import { clarityProvider } from "./clarity"
import { concisionProvider } from "./concision"
import { directnessProvider } from "./directness"
import { sentenceVarietyProvider } from "./sentence-variety"

export { activeVoiceProvider } from "./active-voice"
export { clarityProvider } from "./clarity"
export { CLICHES, findCliches } from "./cliches"
export { concisionProvider } from "./concision"
export { directnessProvider } from "./directness"
export { sentenceVarietyProvider } from "./sentence-variety"

export const styleProviders: ReadonlyArray<DimensionProvider> = [
  activeVoiceProvider,
  clarityProvider,
  directnessProvider,
  concisionProvider,
  sentenceVarietyProvider,
]
