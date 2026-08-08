---
kind: eval-artifact
run: 2
variant: G
replicate: r3
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for two different versions of the same library, and your bundler can only pick one.

Here is what happens under the hood. Package A pins `foo@1.x`. The new package pins `foo@2.x`. The package manager either installs both copies in nested folders, or hoists one to the top and hands it to both. When both copies load, you get two separate module instances, so things like `instanceof` checks, singletons, and shared context break. When only one wins, the package built against the other version calls an API that moved or changed shape.

**Find out which case you have.** Run `pnpm why foo`. It prints every dependent and the version each one resolved to. Two versions in that tree means a duplicate. One version means a peer mismatch, and the error will name the missing or renamed export.

**Then pick a fix, cheapest first:**

1. **Bump the lagging package.** If package A has a newer release that supports `foo@2`, upgrade it and you are done. This is the only fix that removes the problem instead of hiding it.
2. **Add a `resolutions` / `pnpm.overrides` entry.** This forces one version for the whole tree. Do it only when you have checked that the older package really works with the newer library. Otherwise you have swapped a build error for a runtime bug.
3. **Hold the new package back.** If it is not urgent, pin it to a version that still uses `foo@1` and give the other team time to catch up.
4. **Live with two copies.** This works when the library holds no shared state, like a pure date or math helper. It fails hard for React, state stores, and anything with a registry or context.

One more thing to check. If `foo` is listed as a `peerDependency`, the package expects *you* to supply it, and the version range in your root `package.json` decides the winner. Fix it there, not in the sub-package.

Long term, the cure is to lift shared libraries into the root as a single pinned version, so no package chooses on its own.
