/** Injected at build time; falls back to a dev marker under Vitest. */
declare const __VERSION__: string

export const VERSION: `${number}.${number}.${number}` = (
  typeof __VERSION__ === "string" ? __VERSION__ : "0.0.0"
) as `${number}.${number}.${number}`
