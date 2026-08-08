---
kind: eval-artifact
run: sonnet
variant: E
replicate: r1
task: T1
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You have a dependency conflict. Two packages in your tree need different versions of the same library, and your package manager can't give both what they want.

Here's what happens under the hood. Your manager first tries to hoist one shared version to the top level. If the version ranges don't overlap, it falls back to nesting a second copy inside whichever package needs it. That nested copy is often where things break — build tools, bundlers, or type checkers sometimes pick up the wrong copy, or two copies of the same class exist at runtime and fail identity checks (`instanceof`, singletons, React context).

To fix it, run these steps:

1. **Find the conflict.** Run `pnpm why <package>` (or `npm ls <package>`) to see which packages pull in which versions.
2. **Check if one version is a mistake.** If a package pins an old version out of neglect, bump it or open a PR against that package.
3. **Force a single version if the API is compatible.** Use `pnpm.overrides` (or `resolutions` in Yarn, `overrides` in npm) in your root `package.json` to pin everyone to one version.
4. **If the APIs are truly incompatible,** let both versions coexist as nested copies, but check they don't leak across a shared boundary (React, RxJS, and DI containers are the usual pain points).

Start with step 1 — you can't fix what you haven't located.
