/**
 * The batteries-included provider set. As scorer packages land (style, structure, vocabulary in
 * Phase 4) they get spread in here — the CLI and MCP server score with whatever this array holds.
 */

import type { DimensionProvider } from "@prosemeter/core"
import { readabilityProviders } from "@prosemeter/readability"

export const builtinProviders: ReadonlyArray<DimensionProvider> = [...readabilityProviders]
