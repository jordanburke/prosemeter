---
kind: eval-artifact
run: sonnet
variant: A
replicate: r3
task: T1
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Two dependency graphs now disagree, and your package manager can't resolve them both. Team B added a package that needs `lib@2.x`. Your side still needs `lib@1.x`. Something in the tree now asks for two versions that don't overlap.

Depending on your package manager, this shows up two ways:

- **npm/yarn/pnpm can install both** side by side (nested `node_modules`). That's fine for most libraries, but it breaks anything that relies on a single shared instance — React, a DI container, a class with `instanceof` checks across packages, anything with module-level state.
- **The manager can't dedupe them at all**, and you get a hard peer-dependency error at install time.

To fix it:

1. Run `npm ls <lib>` (or `pnpm why <lib>`) to see exactly who wants what version.
2. Check whether the two ranges actually overlap. If `^1.5.0` and `^1.8.0` are both requesting the same major version, a simple bump of the older dependency usually resolves it.
3. If the majors genuinely conflict, see whether one side can upgrade to a version compatible with both. That's the real fix — everyone converges on one version.
4. If you can't touch the other team's package yet, pin a single version with `resolutions` (yarn) or `overrides` (npm/pnpm) as a stopgap. Flag it as temporary — it silently overrides what a package declares it needs, so it can mask real incompatibilities.
5. If the library must be a singleton, that's usually a sign it belongs in `peerDependencies`, so both consumers are forced to agree on one version instead of drifting apart.

Start with step 1 — you need the actual version graph before guessing at a fix.
