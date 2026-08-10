---
kind: eval-artifact
run: 6
variant: P
replicate: r4
task: T1
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Two packages ask for different versions of the same library, and your package manager could not settle on one copy that satisfies both. That is the break.

## What is happening

Before the new package landed, everything needing the library shared one installed copy. The new package asks for a range that copy does not satisfy. The resolver then does one of two things: it installs a second copy nested under the new package, or it keeps one version and leaves the other requester unsatisfied.

Both outcomes break builds, in different ways.

**A duplicate install breaks type identity.** Two copies are two separate modules, even at the same version. A class from copy A fails an `instanceof` check against copy B. TypeScript reports that `Foo` is not assignable to `Foo`. React throws "invalid hook call", because two Reacts each hold their own hook state.

**A single copy breaks the package that wanted the other version.** It calls an API that moved, or passes an argument shape that changed.

Peer dependencies make this louder. A peer dependency says "I do not install this, you do, and it must match this range." When two packages declare peer ranges that do not overlap, npm 7 and later fails the install outright, and pnpm warns.

## How to find it

Ask the resolver what it did.

```
npm ls <library>      # every path that pulls it in, and at what version
pnpm why <library>
yarn why <library>
```

The output names each requester and the version it got. Two version numbers in that tree is your answer.

## How to fix it

Try these in order. Keep the first one that works.

**Upgrade the lagging package.** Most conflicts are one package being behind. If the older consumer has a release that accepts the newer range, upgrade it and the conflict is gone. This is the real fix, because it leaves you one copy and no config to maintain.

**Widen or align the range yourself**, if you own one of the packages. Change a hard pin like `4.2.1` to `^4.2.1` so it can meet the other requirement.

**Force one version.** When you cannot upgrade the lagging package, tell the resolver to use a single copy anyway:

- npm and yarn: `overrides` / `resolutions` in `package.json`
- pnpm: `pnpm.overrides`

This works only when the two versions really are compatible in the ways your code touches them. You are asserting that the older package will survive on the newer library. Read the changelog between the versions before you assert it. If the break is in an API that package calls, you have traded a build error for a runtime one.

**Keep both copies on purpose.** Sometimes the versions are genuinely incompatible and each package needs its own. That is fine, as long as no library object crosses between them. It costs bundle size, and it fails the moment a value from one copy is passed to the other.

## In a monorepo

The same conflict wears a different hat. Two workspace packages declare different ranges, the shared root gets one, and the other package silently resolves to a version it never asked for.

Pin the library at one version across the workspace and enforce it. `syncpack` checks that every package declares the same range. pnpm's `catalog:` protocol lets you declare the version once and reference it everywhere.

## What to tell the other team

Send them the `npm ls` output. The conflict is a shared fact, not a complaint. Ask two questions: can their package widen its range, and does the older consumer have an upgrade path. One of them usually ends it.
