---
kind: eval-artifact
run: 5
variant: A
replicate: r5
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Two packages in your dependency tree ask for versions of the same library that the package manager cannot reconcile into one install. That is the whole problem. The symptom shows up at build time, but the cause is in the resolution step that ran before it.

## What is actually happening

A package manager tries to satisfy every declared version range with a single copy of a library. When the ranges overlap, it picks one version and everyone shares it. When they do not overlap, it has two choices, and both can break your build.

The first choice is to install both copies, nested. npm and pnpm do this. Your build then contains two separate module instances of the same library. Code compiles, but anything that depends on identity across the boundary fails: `instanceof` returns false, singletons are no longer single, React hooks throw "invalid hook call", context providers do not match consumers. Bundle size roughly doubles for that library.

The second choice is to fail loudly. This is what you get with peer dependencies, or with pnpm's stricter resolution, or with a lockfile that cannot be updated without violating a constraint. The error names the two requesters and their ranges.

Read your error message to tell which one you hit. A type error about "two different types with this name exist but they are unrelated" is the duplicate-instance case. An `ERESOLVE` or `unmet peer dependency` error is the hard-failure case.

## How to find the duplicate

```
npm ls <library>          # or: pnpm why <library>, yarn why <library>
```

This prints the tree of who asked for what. You are looking for two entries at the same name with different versions, and for the path that leads to each. Note both paths; you need them for the fix.

## How to fix it, in the order to try

**Update the older requester.** If the package pinning the old version has a newer release that accepts the new range, upgrade it. This is the only fix that removes the conflict rather than papering over it. Check the changelog of the requester, not the library.

**Deduplicate.** If the ranges do overlap and the tree just got messy, `npm dedupe` or `pnpm dedupe` collapses them. This works surprisingly often after a series of incremental installs.

**Force a single version.** Every package manager has a mechanism:

- pnpm: `pnpm.overrides` in `package.json`
- npm: `overrides`
- yarn: `resolutions`

This tells the resolver to install exactly one version regardless of what anyone asked for. It works, and it is a lie you are telling your dependencies. It is safe when the version gap is a patch or a minor and the library follows semver. It is risky across a major, because one of the two packages is now running against an API it was never tested on. If you do this, pin the exact version, leave a comment saying which conflict it resolves, and plan to remove it.

**Declare it a peer dependency.** If the library is one that must be a singleton — React, a state store, an ORM client, anything holding module-level state — the correct long-term shape is for both packages to declare it as a peer dependency rather than a direct one. Then the application installs it once and both packages borrow it. If you own one of the two packages, make this change there.

## The part worth internalizing

Libraries that hold global state cannot tolerate duplicates, and libraries that are pure functions usually can. React, `graphql`, `zod` schemas crossing a boundary, and anything doing `instanceof` checks belong to the first group. A date formatter or a lodash utility belongs to the second. When you are deciding how hard to fight a duplicate, that distinction tells you whether you have a correctness bug or just a size problem.
