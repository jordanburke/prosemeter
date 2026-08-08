---
kind: eval-artifact
run: 5
variant: L
replicate: r3
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for versions of the same library that cannot both be satisfied, so the resolver either installed two copies or picked one that does not fit. Fix it by aligning the two ranges on a single version, or by forcing one with an override.

Here is what happened. The new package declared a dependency on, say, `lib@^3`. Your package already depended on `lib@^2`. Those ranges do not overlap. Your package manager has two ways out, and both can break a build.

The first way is duplication. npm and pnpm can install both versions, one nested under each dependent. Two copies then exist at once. That breaks anything that relies on shared state — a singleton, a registry, an `instanceof` check, a React context. The classic symptom is "invalid hook call" or "two copies of React". It also inflates the bundle.

The second way is hoisting to one version. Yarn's `resolutions` behavior, pnpm's peer resolution, and any lockfile that flattens will pick a single copy. The package that wanted the other range now runs against an API it was not written for. You get a missing export, a changed signature, or a runtime type error.

Peer dependencies add a third case. If the library is a peer dependency, the package manager will not install it twice at all. It warns or errors instead, and pnpm errors by default.

Diagnose it first. Run `npm ls <library>` or `pnpm why <library>` to print the tree of who asks for what. That names both dependents and both ranges. Check the lockfile for two entries under the same library name.

Then pick a fix.

**Bump the older dependent.** This is the right fix when a newer release of your package supports the newer range. Upgrade it and delete the conflict.

**Ask the other team to widen their range.** If they only need features present in v2, they can declare `^2 || ^3` and the conflict goes away. This works well inside a monorepo where you control both sides.

**Force one version.** Add `overrides` in npm, `resolutions` in Yarn, or `pnpm.overrides` in pnpm. This pins every dependent to one copy. It works, but you are asserting compatibility the ranges deny, so test the loser hard. Leave a comment saying why the override exists and when it can go.

**Allow the duplicate on purpose.** If the library holds no shared state — a date formatter, a string utility — two copies are harmless apart from size. Do nothing beyond confirming that.

For a monorepo, prevent the next one. Pin shared libraries in a single place — a catalog in pnpm, a syncpack rule, or a workspace-root dependency — and add a CI check that fails on duplicate versions of libraries you care about.
