---
kind: eval-artifact
run: 5
variant: A
replicate: r3
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Two packages in your dependency tree ask for different versions of the same library. Your package manager has to pick what ends up on disk, and the choice it made no longer satisfies one of the two.

## What is actually happening

Package managers resolve a version range, not an exact version. If your existing package asks for `^1.4.0` and the new one asks for `^2.0.0`, those ranges do not overlap, so no single version satisfies both.

From there, two things can happen, and which one you get explains the shape of the break.

**The manager installs one copy.** npm and yarn hoist a single version to the top of `node_modules` when they can. The package that wanted the other version gets the hoisted one, and it breaks at runtime or at type-check on an API that changed. This is the classic "worked yesterday" break.

**The manager installs both copies.** pnpm does this by default, and npm does it when hoisting fails. Now nothing is missing, but you have two separate module instances. That breaks anything that relies on shared identity: `instanceof` checks fail across the boundary, singletons stop being single, React throws "invalid hook call" because there are two Reacts, and context providers do not reach consumers on the other copy.

The tell for the second case is a bundle that got bigger and errors that read as impossible, like an object failing an `instanceof` check against the exact class it was built from.

## How to see which one you have

```bash
npm ls <library>          # or pnpm why <library>
```

That prints every requester and the version each got. If you see one version listed with multiple parents, you are in case one. If you see two version numbers, you are in case two.

## How to fix it

Work down this list and stop at the first that applies.

**Upgrade the older consumer.** If the package pinned to `^1.4.0` has a release that accepts `^2`, upgrading it makes the ranges overlap and the problem disappears. This is the only fix that leaves no residue, so spend the time here before moving on.

**Make the library a peer dependency.** If the library is one that must be a singleton — React, a state store, an ORM client — the packages depending on it should declare it in `peerDependencies`, not `dependencies`. That pushes the version choice up to your app, where exactly one copy gets installed. If you own the packages, change this. If you do not, file it upstream, because a singleton library shipped as a regular dependency is a bug.

**Force one version.** Every manager has an escape hatch: `overrides` in npm, `resolutions` in yarn, `pnpm.overrides` in pnpm.

```json
{
  "overrides": {
    "some-lib": "2.1.0"
  }
}
```

This says "everyone gets 2.1.0, whatever they asked for." It works, and it is a lie you are telling the resolver. The package that wanted v1 now runs against v2 untested. Use it when you have read the changelog and know the breaking change does not touch the paths that package uses. Leave a comment saying why, and an issue to remove it.

**Keep both, deliberately.** If the library holds no shared state — a date formatter, a string utility — two copies cost bundle size and nothing else. Accept it and move on.

## What not to do

Do not delete the lockfile and reinstall. That reshuffles the resolution and may hide the conflict until a later install brings it back, usually in CI, usually on someone else's branch.

Do not pin every dependency to an exact version to stop this recurring. It stops resolution surprises and replaces them with a tree that never gets security patches.

## Preventing the next one

Add `npm ls` (or `pnpm why` on the libraries that must be singletons) to CI so a duplicate fails the build instead of surfacing as a runtime mystery. In a monorepo, put the shared libraries in one place — a catalog in pnpm, a single root dependency elsewhere — so packages cannot drift apart in the first place.
