---
kind: eval-artifact
run: 5
variant: L
replicate: r4
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Two versions of the same library are now in your dependency tree, and your code is loading the wrong one. Fix it by forcing a single version.

Here is what happened. The new package asks for version 2 of a library you already use at version 1. The package manager cannot satisfy both with one copy, so it installs both. Node then hands each importer its own nearest copy.

That breaks the build in two ways. Type declarations from the two copies do not match, so TypeScript reports that a value of type X is not assignable to type X. And instance checks fail at runtime, because a class from copy A is not the same class as copy B.

Start by finding the duplicate. Run `pnpm why <library>` (or `npm ls <library>`). It prints every path that pulls the library in, and the version each path got.

Then pick a fix.

**Upgrade your side.** If your package can move to version 2, do that. One version remains, the duplicate disappears, and nothing needs pinning. Try this first.

**Override the version.** If you cannot upgrade, force one copy with a resolution. In pnpm, add `pnpm.overrides` in the root `package.json`. In npm, use `overrides`. In yarn, use `resolutions`. This works only when the two versions are actually compatible — check the library's changelog for breaking changes before you rely on it.

**Make it a peer dependency.** If the library holds state that must be shared — a React, a database client, a DI container — the library should declare it as a peer dependency, not a direct one. Peers force the consumer to supply one copy. Ask the other team to make that change if their package got it wrong.

Do not just delete the lockfile and reinstall. That sometimes hides the duplicate by luck, and it comes back on the next install.
