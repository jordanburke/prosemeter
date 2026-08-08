---
kind: eval-artifact
run: 5
variant: L
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for versions of the same library that the package manager cannot merge into one. Fix it by picking a single version everyone can live with, then telling the package manager to use it.

Here is what happened. The new package declared a range like `^3.0.0`. Yours declares `^2.1.0`. Those ranges do not overlap, so the resolver installed both copies. Now two copies of the library sit in the tree.

Two copies break a build in three common ways.

- TypeScript sees two sets of type declarations for the same name and refuses to treat them as the same type.
- Bundlers ship both copies, so `instanceof` checks fail across the boundary.
- Libraries that hold module-level state — React, a DI container, an event bus — get two separate states and behave as if two apps are running.

Do this to fix it, in order of preference.

1. **Upgrade the lagging package.** Move your dependency to the newer range so both land on one version. This is the real fix. Read the library's changelog for breaking changes first.
2. **Pin the version for the whole workspace.** pnpm gives you `overrides` in the root `package.json`. npm calls it `overrides`, yarn calls it `resolutions`. You are telling the resolver to force one version everywhere, so test the packages you overrode.
3. **Move the library to a peer dependency.** If the library must be a singleton, declare it as `peerDependencies` in both packages and install it once at the root. The package manager will then warn you the next time versions drift instead of silently duplicating.

Confirm the fix by asking the tree what it installed: `pnpm why <library>` (or `npm ls <library>`). One entry means you are done. Two entries mean the override did not take.

One warning. Deleting `node_modules` and the lockfile makes the error move, not vanish. The conflict lives in the declared ranges, so change those.
