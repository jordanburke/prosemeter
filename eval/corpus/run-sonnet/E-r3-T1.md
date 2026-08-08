---
kind: eval-artifact
run: sonnet
variant: E
replicate: r3
task: T1
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Two packages want two different versions of the same library, and your package manager can't give both what they want in a single copy. This is a version conflict, sometimes called a diamond dependency: your app depends on Package A and Package B, A needs `lib@1.x`, B needs `lib@2.x`, and something in the resolution breaks.

Check your lockfile first. Run `npm ls <library>` (or `pnpm why <library>` / `yarn why <library>`) to see who wants what version. That tells you the real shape of the conflict, not just the error.

From there you have three fixes:

1. **Bump the older dependency.** If Package A has a newer release that supports `lib@2.x`, upgrade A. This is the cleanest fix.
2. **Let the package manager dedupe or nest.** npm and pnpm can often install two copies of the library side by side, one nested inside each package's `node_modules`. This works for libraries without shared global state (most do), but breaks for singletons (React, for example, breaks badly with two copies).
3. **Pin and override.** If you can't upgrade yet, use `overrides` (npm) or `resolutions` (yarn/pnpm) in `package.json` to force one version everywhere, then test that both packages still work against it.

Start with option 1. It fixes the root cause instead of papering over it.
