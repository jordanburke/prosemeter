/** The published package version, injected at build time. Falls back to a dev marker under Vitest. */
export const VERSION: string = typeof __VERSION__ === "string" ? __VERSION__ : "0.0.0-dev"
