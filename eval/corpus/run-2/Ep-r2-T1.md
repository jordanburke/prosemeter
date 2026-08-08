---
kind: eval-artifact
run: 2
variant: Ep
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for different versions of the same library, and your package manager can only pick one to sit at the top of `node_modules`.

Here is what happens. The new package declares a dependency range that does not overlap with the range your package already declares. The resolver hoists one version to the root and nests the other, or it refuses to hoist either. Code that expected a single shared copy now sees two, or sees the wrong one. If the library holds state — a registry, a singleton client, a class you do `instanceof` against — the two copies do not recognize each other, and you get errors that read like the library is broken.

You also get the type-level version of this. TypeScript resolves declarations through the same tree, so two copies of a library means two structurally identical but nominally distinct types, and assignments between them fail.

**To fix it, in order of preference:**

1. **Align the ranges.** Find who depends on what: `pnpm why <library>`. If the two ranges can both be satisfied by one version, widen the tighter one and let the resolver dedupe. This is the real fix.
2. **Bump the lagging package.** If the older package pins an old major, check whether a newer release of it supports the new major. Upgrading it is usually less work than the alternatives.
3. **Force a single version.** In pnpm, add a `resolutions`/`overrides` entry pinning the library to one version for the whole workspace. Do this only when you have checked the API actually is compatible across those versions — you are overruling the package's own declared constraint, and a wrong guess turns a build error into a runtime error.
4. **Make it a peer dependency.** If the library is meant to be shared — React, a logging client, an ORM — the packages that use it should declare it as a peer, not a direct dependency. Then the app decides the version and everyone gets the same copy.

Start with `pnpm why`. The output tells you which of these four you are actually in.
