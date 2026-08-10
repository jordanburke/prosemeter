---
kind: eval-artifact
run: 6
variant: R
replicate: r4
task: T1
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Two packages ask for different versions of the same library. Your package manager found no single copy that satisfies both. That is the break.

## What is happening

Your dependency tree is no longer flat. Before the new package landed, everything that needed the library shared one installed copy. The new package pins a range the old copy does not satisfy. So the resolver did one of two things. It installed a second copy nested under the new package, or it hoisted one version and left the other requester unsatisfied.

Both outcomes break builds, in different ways.

A duplicate install breaks type identity. Two copies of a library are two separate modules, even at the same version. A class from copy A fails an `instanceof` check against copy B. TypeScript reports that `Foo` is not assignable to `Foo`. React throws "invalid hook call" because two Reacts each hold their own hook state.

A single hoisted copy breaks the package that wanted the other version. It calls an API that moved, or passes an argument shape that changed.

Peer dependencies make this louder. A peer dependency says "I do not install this, you do, and it must match this range." When two packages declare incompatible peer ranges, npm 7+ fails the install outright and pnpm warns loudly.

## How to find it

Ask the resolver what it did.

```
npm ls <library>      # every path that pulls it in, and at what version
pnpm why <library>
yarn why <library>
```

The output shows each requester and the version it got. Two version numbers in that tree is your answer.

## How to fix it

Try these in order. The first one that works is the one to keep.

**Upgrade the lagging package.** Version conflicts start as one package being behind. If the older consumer has a release that accepts the newer range, upgrade it and the conflict disappears. This is the real fix. It leaves you with one copy and no config to maintain.

**Widen or align the range yourself** if you own one of the packages. Change a hard pin like `4.2.1` to `^4.2.1` so it can meet the other requirement.

**Force one version.** When you cannot upgrade the lagging package, tell the resolver to use a single copy:

- npm and yarn: `"overrides"` / `"resolutions"` in `package.json`
- pnpm: `pnpm.overrides`

This works only when the two versions agree on the APIs your code touches. You are asserting that the older package will survive on the newer library. Read the changelog between the versions before you assert it. If the break lands in an API that package calls, you have swapped a build error for a runtime one.

**Keep both copies on purpose.** The versions may be incompatible, and both packages may need their own. That is fine, as long as no library object crosses between them. It costs bundle size, and it fails the moment a value from one copy is passed to the other.

## In a monorepo

The same conflict shows up as a hoisting problem. Two workspace packages declare different ranges. The shared root gets one, and the other package silently resolves to a version it never asked for.

Pin the shared library at one version across the workspace and enforce it. `syncpack` checks that every package declares the same range. pnpm's `catalog:` protocol lets you declare the version once and reference it everywhere.

## What to tell the other team

Send them the `npm ls` output. The conflict is a shared fact, not a complaint. Ask whether their package can widen its range, or whether the older consumer has an upgrade path. One of those two questions ends it.
