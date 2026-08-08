---
kind: eval-artifact
run: 3
variant: E
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two copies of the same library are now in the tree, and something in your code expects only one.

The new package asks for a different version range than yours does. The package manager cannot satisfy both with one copy, so it installs both — one at the top level, one nested under the new package. Most of the time that is harmless. It breaks when the library holds state that must be shared, or when a type from copy A gets passed to code compiled against copy B. That is where you get errors like "types are not assignable" on types that look identical, or `instanceof` checks that fail on objects that clearly are the right class.

Run `pnpm why <library>` to see who pulls in which version. That tells you the two ranges in conflict.

Then pick one of these fixes:

- **Best: align the ranges.** Bump your package (or ask the other team to bump theirs) so both ranges overlap. The package manager then dedupes to one copy on its own. This is the only fix that removes the real problem.
- **Fast: force a single version.** Add a `pnpm.overrides` entry (or `resolutions` in yarn/npm) pinning the library to one version for the whole workspace. This works when the two versions are compatible in practice. It lies to whichever package wanted the other version, so test that package after.
- **If the library must be a singleton** — React, a DI container, anything with module-level state — make it a `peerDependency` in both packages instead of a `dependency`. Then the app installs it once and both packages use that copy.

Check the library's major versions first. If one package wants v2 and the other wants v4, an override will paper over a real breaking change and fail at runtime instead of build time. In that case you have to upgrade one of them for real.
