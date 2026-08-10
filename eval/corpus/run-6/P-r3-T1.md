---
kind: eval-artifact
run: 6
variant: P
replicate: r3
task: T1
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Two packages in your tree ask for different versions of the same library. Your package manager picked one answer, and that answer no longer satisfies one of them.

## What is happening

Package managers resolve a version *range*, not an exact version. Your old package asks for `^1.4.0`. The new one asks for `^2.0.0`. Those ranges do not overlap, so no single version satisfies both.

From there the manager does one of two things, and which one you got explains the shape of your break.

**It installs one copy.** npm and yarn hoist a single version to the top of `node_modules` when they can. The package that wanted the other version gets the hoisted one and breaks on an API that changed — at runtime, or at type-check. This is the classic "worked yesterday" failure.

**It installs both copies.** pnpm does this by default, and npm does it when hoisting fails. Nothing is missing now, but you have two separate module instances. Anything that depends on shared identity breaks: `instanceof` fails across the boundary, singletons stop being single, React throws "invalid hook call" because there are two Reacts, and a context provider never reaches consumers on the other copy.

The tell for two copies is a bigger bundle plus errors that read as impossible — an object failing an `instanceof` check against the exact class that built it.

## How to tell which one you have

```bash
npm ls <library>          # or pnpm why <library>
```

That prints every requester and the version each one got. One version with several parents means one copy. Two version numbers mean two copies.

## How to fix it

Work down this list. Stop at the first that applies.

**Upgrade the older consumer.** If the package pinned to `^1.4.0` has a release that accepts `^2`, upgrading makes the ranges overlap and the conflict disappears. This is the only fix that leaves nothing behind, so spend your time here before moving on.

**Make the library a peer dependency.** Some libraries must be a singleton — React, a state store, an ORM client. Packages that use one should declare it in `peerDependencies`, not `dependencies`. That pushes the version choice up to your app, where exactly one copy gets installed. Change it if you own the package. File it upstream if you do not, because a singleton library shipped as a regular dependency is a bug.

**Force one version.** Every manager has an escape hatch: `overrides` in npm, `resolutions` in yarn, `pnpm.overrides` in pnpm.

```json
{
  "overrides": {
    "some-lib": "2.1.0"
  }
}
```

This says "everyone gets 2.1.0, whatever they asked for." It works, and it is a lie you are telling the resolver. The package that wanted v1 now runs against v2 untested. Use it only after you have read the changelog and know the breaking change misses the paths that package uses. Leave a comment saying why, and an issue to remove it.

**Keep both, on purpose.** If the library holds no shared state — a date formatter, a string utility — two copies cost bundle size and nothing else. Accept it and move on.

## What not to do

Do not delete the lockfile and reinstall. That reshuffles the resolution and can hide the conflict until a later install brings it back, usually in CI, usually on someone else's branch.

Do not pin every dependency to an exact version to stop this recurring. You trade resolution surprises for a tree that never gets security patches.

## Preventing the next one

Add `npm ls` — or `pnpm why` on the libraries that must be singletons — to CI, so a duplicate fails the build instead of surfacing as a runtime mystery. In a monorepo, declare shared libraries in one place: a catalog in pnpm, a single root dependency elsewhere. Then packages cannot drift apart to begin with.
