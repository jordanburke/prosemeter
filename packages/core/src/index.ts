/**
 * @prosemeter/core — the engine. Types, the parse pipeline, scoring math, profiles, config
 * resolution, the provider registry, and the loop contract. Knows nothing about specific NLP
 * rules; scorer packages implement `DimensionProvider` against these contracts.
 */

export type { ConfigError, ConfigResult, ResolvedConfig, UserConfig } from "./config"
export { resolveConfig } from "./config"
export type { ConvergenceOptions } from "./loop"
export { checkConvergence, compareBaseline } from "./loop"
export { parse } from "./parse"
export { DEFAULT_PROFILE, profileNames, PROFILES } from "./profiles"
export type { RunScoreOptions, ScoreError } from "./registry"
export { runScore, scoreDocument } from "./registry"
export { band, composite, density, ratio } from "./scoring"
export * from "./types"
