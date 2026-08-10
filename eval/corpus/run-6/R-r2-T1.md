---
kind: eval-artifact
run: 6
variant: R
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Your build broke over a version conflict. Two packages in the tree want different versions of the same library. The package manager cannot pick one version that satisfies both.

## What is happening

A package manager checks every dependency's version range against every other one. When two ranges overlap, it picks one version and both packages share it. When they do not overlap, the manager has two moves. Say one package requires `^3.0.0` and the new one requires `^5.0.0`. Both moves can break a build.

**Move one: it installs both copies.** npm and pnpm nest a second copy of the library deeper in `node_modules`. Nothing errors at install time. The break comes later, at runtime or at type-check time, and it looks unrelated to versions:

- Type errors like `Type 'Foo' is not assignable to type 'Foo'`. Same name, two declaration files. TypeScript treats them as unrelated types.
- `instanceof` checks fail. The class object from copy A is not the class object from copy B.
- Singletons stop being single. Anything holding module-level state now exists twice — a React context, a connection pool, a plugin registry, an event bus. Half your code talks to the wrong instance.
- Bundle size doubles for that library.

**Move two: it refuses.** Yarn's `peerDependency` errors and pnpm's stricter resolution fail the install or the build. That is the friendlier outcome, because it tells you the truth at once.

Peer dependencies make this worse. Say the library is React, or a plugin host. It is declared as a peer dependency because there must be exactly one copy. A peer range mismatch between the two packages produces the `ERESOLVE` wall of text.

## How to see it

Find out who wants what before you change anything:

```bash
npm ls <library>          # or
pnpm why <library>        # or
yarn why <library>
```

That prints the tree of requesters and the version each one asked for. Look for two branches with ranges that do not overlap.

## How to fix it

In rough order of preference:

**1. Upgrade the lagging package.** This is the cleanest fix. Check the changelog. If the older package has a newer release that widens its range to include version 5, upgrade it and the conflict goes away.

**2. Move the library to a shared direct dependency.** Both packages declare it as a peer. So install one version yourself at the top level, in a range both accept. The shared copy becomes explicit instead of incidental.

**3. Force a single version.** Every manager has an escape hatch:

- pnpm: `"pnpm": { "overrides": { "lib": "5.2.0" } }`
- npm: `"overrides": { "lib": "5.2.0" }`
- Yarn: `"resolutions": { "lib": "5.2.0" }`

This is a real fix when the ranges are pessimistic. A library declared `^3.0.0` frequently works on 5.x. It is a lie when the ranges are honest. Test the package whose range you overrode. If it breaks, you have swapped a build error for a runtime one.

**4. Accept two copies.** This works when the library holds no shared state and is not a peer dependency — a date formatter, a small utility. You pay bundle size and nothing else. Never do this for anything with a registry, a context, or a singleton.

**5. Hold the new package back.** Pin the new package to a version your existing tree accepts. That buys time when the upgrade is not urgent and the conflict runs deep.

## Preventing the next one

A monorepo-wide catalog forces one version of shared libraries across all workspaces — pnpm's `catalog:` protocol, or Yarn constraints. It turns this failure from a surprise at install time into a policy decision you make on purpose.
