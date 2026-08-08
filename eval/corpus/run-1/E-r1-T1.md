---
kind: eval-artifact
run: 1
variant: E
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: major
  foundBy: "opus,sonnet"
  error: "Entire causal explanation rests on the hoisting misconception. Also claims adding a direct dependency changes how another package's dependency resolves."
---
Your build broke because two packages now ask for different versions of the same library, and the package manager can only hoist one of them to the top of `node_modules`. Whichever version wins, the other package gets a library it was not built against. That shows up as a type error, a missing export, or a runtime crash like `X is not a function`.

The version mismatch was always there. Adding the new package is what made the resolver pick a different winner than before.

**Find out what you actually have:**

```bash
pnpm why <library-name>      # npm ls <library-name> / yarn why <library-name>
```

That prints every package that depends on the library and the version each one resolved to. Look for two or more distinct versions in the tree.

**Then pick a fix, roughly in this order:**

1. **Bump the lagging package.** If the older dependent has a newer release that accepts the new version, upgrade it. This is the real fix because it removes the conflict instead of hiding it.
2. **Align the range yourself.** If both packages can live on one version, add the library to your own `dependencies` at that version so the resolver has an obvious answer.
3. **Force it with an override.** Use `pnpm.overrides` (or npm `overrides`, yarn `resolutions`) in the root `package.json` to pin one version for the whole tree. This works when the ranges disagree but the code is actually compatible — a package that declared `^2.0.0` usually runs fine on `2.4.0`.
4. **Let both versions coexist.** If the versions are genuinely incompatible, stop deduping and let each package keep its own copy nested under it. This costs bundle size, and it breaks outright if the library holds shared state or relies on `instanceof` checks across the boundary.

Two things to watch. A peer dependency warning is the package telling you it will not bring its own copy, so you must supply a version both sides accept. And a duplicated library that carries singleton state — React, a DI container, an ORM connection pool — fails in confusing ways rather than loudly, so treat those as must-dedupe.

Send me the `pnpm why` output if you want a second read on which branch to take.
