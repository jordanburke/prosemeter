/**
 * Profile + user-config resolution.
 *
 * A user config (`prosemeter.config.json`) extends a built-in profile and may override the grade
 * band, weights, rule severities, threshold, and per-dimension options. Validation *accumulates*
 * every error and reports them together via functype's validation result — the same shape as
 * `FormValidation<T>` (`Either<List<TypedError<"VALIDATION_FAILED">>, T>`), using `TypedError`'s
 * structured `{ field, value, rule }` context so callers get typed, machine-readable errors.
 *
 * `Validation.form`'s rule DSL (`min:`, `max:`, `pattern:`…) fits flat scalar fields, but config
 * resolution has cross-field checks (`lo < hi`), dynamic-key records (weights/rules), and profile
 * lookup that the DSL can't express — so errors are accumulated by hand into the same result type.
 */

import { Either, List, TypedError } from "functype"

import { DEFAULT_PROFILE, PROFILES } from "./profiles"
import type { GradeBand, Profile, Severity } from "./types"

export type UserConfig = {
  readonly extends?: string
  readonly gradeBand?: { readonly lo?: number; readonly hi?: number }
  readonly weights?: Readonly<Record<string, number>>
  readonly rules?: Readonly<Record<string, Severity | "off">>
  readonly threshold?: number
  readonly dimensionOptions?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

export type ConfigError = TypedError<"VALIDATION_FAILED">

/** An accumulating validation result, in functype's `FormValidation` shape. */
export type ConfigResult = Either<List<ConfigError>, ResolvedConfig>

/** A fully-resolved profile: a built-in profile with the user config merged in. */
export type ResolvedConfig = {
  readonly profile: string
  readonly gradeBand: GradeBand
  readonly weights: Readonly<Record<string, number>>
  readonly rules: Readonly<Record<string, Severity | "off">>
  readonly threshold: number
  readonly dimensionOptions: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

const invalid = (field: string, value: unknown, rule: string): ConfigError => TypedError.validation(field, value, rule)

const isSeverity = (value: unknown): value is Severity | "off" =>
  value === "info" || value === "warn" || value === "error" || value === "off"

const validateWeights = (weights: Readonly<Record<string, number>>): ReadonlyArray<ConfigError> =>
  Object.entries(weights).flatMap(([id, w]) =>
    typeof w !== "number" || Number.isNaN(w) || w < 0 ? [invalid(`weights.${id}`, w, "must be a number >= 0")] : [],
  )

const validateRules = (rules: Readonly<Record<string, Severity | "off">>): ReadonlyArray<ConfigError> =>
  Object.entries(rules).flatMap(([rule, sev]) =>
    isSeverity(sev) ? [] : [invalid(`rules.${rule}`, sev, "must be one of info|warn|error|off")],
  )

const resolveGradeBand = (base: GradeBand, override: UserConfig["gradeBand"]): GradeBand => ({
  lo: override?.lo ?? base.lo,
  hi: override?.hi ?? base.hi,
})

/**
 * Resolve a profile name and optional user config into a `ResolvedConfig`. Accumulates every
 * validation error into a `List` before returning `Left`.
 */
export const resolveConfig = (profileName: string = DEFAULT_PROFILE, userConfig: UserConfig = {}): ConfigResult => {
  const baseName = userConfig.extends ?? profileName
  const base: Profile | undefined = PROFILES[baseName]

  const errors: Array<ConfigError> = []
  if (base === undefined) {
    errors.push(
      invalid(
        userConfig.extends !== undefined ? "extends" : "profile",
        baseName,
        `is not a known profile; available: ${Object.keys(PROFILES).join(", ")}`,
      ),
    )
  }

  const gradeBand = resolveGradeBand(base?.gradeBand ?? { lo: 8, hi: 12 }, userConfig.gradeBand)
  if (gradeBand.lo >= gradeBand.hi) {
    errors.push(invalid("gradeBand", gradeBand, `lo (${gradeBand.lo}) must be < hi (${gradeBand.hi})`))
  }

  const weights = { ...(base?.weights ?? {}), ...(userConfig.weights ?? {}) } as Record<string, number>
  errors.push(...validateWeights(userConfig.weights ?? {}))

  const rules = { ...(base?.rules ?? {}), ...(userConfig.rules ?? {}) } as Record<string, Severity | "off">
  errors.push(...validateRules(userConfig.rules ?? {}))

  const dimensionOptions = {
    ...(base?.dimensionOptions ?? {}),
    ...(userConfig.dimensionOptions ?? {}),
  } as Record<string, Readonly<Record<string, unknown>>>

  const threshold = userConfig.threshold ?? base?.thresholdDefault ?? 70
  if (typeof threshold !== "number" || threshold < 0 || threshold > 100) {
    errors.push(invalid("threshold", threshold, "must be a number in [0, 100]"))
  }

  if (errors.length > 0) {
    return Either.left<List<ConfigError>, ResolvedConfig>(List(errors))
  }

  return Either.right<List<ConfigError>, ResolvedConfig>({
    profile: baseName,
    gradeBand,
    weights,
    rules,
    threshold,
    dimensionOptions,
  })
}
