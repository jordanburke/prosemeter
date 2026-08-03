/**
 * Shared resolution of a retext plugin's `ignore` list from a profile's `dimensionOptions`.
 *
 * Both retext-simplify and retext-intensify match on the word alone, with no regard for syntactic
 * role or domain, and both accept an `ignore` array that filters their dictionary before matching.
 * Every entry is a lowercase dictionary key, so one entry covers every casing of the word.
 */

const asStringArray = (value: unknown): ReadonlyArray<string> =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []

/**
 * `options.ignore` adds to `defaults`; `options.useDefaultIgnore: false` drops them entirely.
 * A profile that wants the raw plugin behaviour sets the latter.
 */
export const resolveIgnore = (
  options: Readonly<Record<string, unknown>>,
  defaults: ReadonlyArray<string>,
): ReadonlyArray<string> => [...(options.useDefaultIgnore === false ? [] : defaults), ...asStringArray(options.ignore)]
