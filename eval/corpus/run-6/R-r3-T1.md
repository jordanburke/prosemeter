---
kind: eval-artifact
run: 6
variant: R
replicate: r3
task: T1
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Two packages ask for different versions of the same library. Your package manager picks one version for disk. That choice no longer satisfies one of the two.

## What is happening

Package managers resolve a range, not an exact version. Your existing package asks for `^1.4.0`. The new one asks for `^2.0.0`. Those ranges do not overlap, so no single version satisfies both.

From there, two outcomes are possible. Which one you get explains the shape of the break.

**The manager installs one copy.** npm and yarn hoist a single version to the top of `node_modules` when they can. The package that wanted the other version gets the hoisted one. It then breaks at runtime or at type-check, on an API that changed. This is the classic "worked yesterday" break.

**The manager installs both copies.** pnpm does this by default. npm does it when hoisting fails. Nothing is missing now, but you hold two separate module instances. Anything relying on shared identity breaks: `instanceof` checks fail across the boundary, singletons stop being single, React throws "invalid hook call" because two Reacts exist, and context providers do not reach consumers on the other copy.

The tell for the second case is a bigger bundle and errors that read as impossible — an object failing an `instanceof` check against the exact class that built it.

## How to see which one you have

```bash
npm ls <library>          # or pnpm why <library>
```

That prints every requester and the version each got. One version with multiple parents is case one. Two version numbers is case two.

## How to fix it

Work down this list. Stop at the first item that applies.

**Upgrade the older consumer.** The package pinned to `^1.4.0` may have a release that accepts `^2`. Upgrading it makes the ranges overlap and the problem disappears. This fix leaves no residue, so spend your time here before moving on.

**Make the library a peer dependency.** Some libraries must be a singleton — React, a state store, an ORM client. Packages depending on them should declare them in `peerDependencies`, not `dependencies`. That pushes the version choice up to your app, where exactly one copy gets installed. Change this in packages you own. File it upstream for packages you do not, because a singleton library shipped as a regular dependency is a bug.

**Force one version.** Every manager has an escape hatch: `overrides` in npm, `resolutions` in yarn, `pnpm.overrides` in pnpm.

```json
{
  "overrides": {
    "some-lib": "2.1.0"
  }
}
```

This tells the resolver that everyone gets 2.1.0, no matter what they asked for. It works, and it is a lie. The package that wanted v1 now runs against v2 untested. Use it after you have read the changelog and confirmed the breaking change misses the paths that package uses. Leave a comment saying why, plus an issue to remove it.

**Keep both, deliberately.** A library that holds no shared state — a date formatter, a string utility — costs you bundle size and nothing else in duplicate. Accept it and move on.

## What not to do

Do not delete the lockfile and reinstall. That reshuffles the resolution and can hide the conflict until a later install brings it back — in CI, on another branch.

Do not pin every dependency to an exact version to stop this recurring. It trades resolution surprises for a tree that never gets security patches.

## Preventing the next one

Add `npm ls` to CI, or `pnpm why` on the libraries that must be singletons, so a duplicate fails the build instead of surfacing as a runtime mystery. In a monorepo, declare shared libraries in one place — a catalog in pnpm, a single root dependency elsewhere — so packages cannot drift apart at all.
