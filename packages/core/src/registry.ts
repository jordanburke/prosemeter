/**
 * Provider registry + scoring orchestration.
 *
 * Core knows nothing about specific NLP rules — the caller (the bundle package) passes the set of
 * `DimensionProvider`s to run. The registry resolves each provider's effective weight from the
 * profile, evaluates it, and turns any failure into a `skipped` dimension: one broken rule never
 * kills a scoring run. The registry owns the final `weight` on every result, so providers only
 * report score / detail / findings.
 */

import type { List } from "functype"
import { Either, Some } from "functype"

import type { ConfigError, ResolvedConfig, UserConfig } from "./config"
import { resolveConfig } from "./config"
import { parse } from "./parse"
import { composite } from "./scoring"
import type {
  DimensionProvider,
  DimensionResult,
  DimensionSettings,
  DocumentFormat,
  ParsedDocument,
  ParseError,
  ScoreResult,
} from "./types"

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err))

const evaluateProvider = (
  provider: DimensionProvider,
  doc: ParsedDocument,
  resolved: ResolvedConfig,
): DimensionResult => {
  const weight = resolved.weights[provider.id] ?? provider.defaultWeight

  if (weight <= 0) {
    return {
      id: provider.id,
      score: 0,
      weight: 0,
      detail: "disabled by profile",
      findings: [],
      skipped: Some("disabled by profile"),
    }
  }

  const settings: DimensionSettings = {
    weight,
    gradeBand: resolved.gradeBand,
    severities: new Map(Object.entries(resolved.rules)),
    options: resolved.dimensionOptions[provider.id] ?? {},
  }

  return provider.evaluate(doc, settings).fold(
    (err): DimensionResult => ({
      id: provider.id,
      score: 0,
      weight,
      detail: `skipped: ${errorMessage(err)}`,
      findings: [],
      skipped: Some(errorMessage(err)),
    }),
    (result): DimensionResult => ({ ...result, weight }),
  )
}

/** Score an already-parsed document with a resolved config. Pure; the composite renormalizes. */
export const scoreDocument = (
  doc: ParsedDocument,
  providers: ReadonlyArray<DimensionProvider>,
  resolved: ResolvedConfig,
  options: { readonly target?: string; readonly version?: string } = {},
): ScoreResult => {
  const dimensions = providers.map((provider) => evaluateProvider(provider, doc, resolved))
  return {
    target: options.target ?? "<stdin>",
    profile: resolved.profile,
    score: composite(dimensions),
    stats: doc.stats,
    dimensions,
    version: options.version ?? "0.0.0",
  }
}

export type ScoreError =
  | { readonly kind: "parse"; readonly error: ParseError }
  | { readonly kind: "config"; readonly errors: List<ConfigError> }

export type RunScoreOptions = {
  readonly target?: string
  readonly profile?: string
  readonly config?: UserConfig
  readonly format?: DocumentFormat
  readonly version?: string
}

/** Parse → resolve config → score, threading both failure channels into one `ScoreError`. */
export const runScore = (
  raw: string,
  providers: ReadonlyArray<DimensionProvider>,
  options: RunScoreOptions = {},
): Either<ScoreError, ScoreResult> =>
  parse(raw, options.format)
    .mapLeft((error): ScoreError => ({ kind: "parse", error }))
    .flatMap((doc) =>
      resolveConfig(options.profile, options.config)
        .mapLeft((errors): ScoreError => ({ kind: "config", errors }))
        .map((resolved) =>
          scoreDocument(doc, providers, resolved, { target: options.target, version: options.version }),
        ),
    )
