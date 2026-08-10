---
kind: eval-artifact
run: 6
variant: R
replicate: r5
task: T1
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Two packages ask for versions of the same library. The package manager cannot merge those requests into one install. The symptom shows up at build time. The cause is the resolution step that ran before it.

## What is happening

A package manager tries to satisfy every declared version range with one copy of a library. When the ranges overlap, it picks one version and everyone shares it. When they do not overlap, it has two choices. Both break your build.

The first choice is to install both copies, nested. npm and pnpm do this. Your build then has two separate module instances of the same library. Code compiles. Anything depending on identity across the boundary fails: `instanceof` returns false, singletons are no longer single, React hooks throw "invalid hook call", context providers do not match consumers. Bundle size doubles for that library.

The second choice is to fail loudly. You get this with peer dependencies, with pnpm's stricter resolution, or with a lockfile that cannot be updated without breaking a constraint. The error names the two requesters and their ranges.

Read your error message to tell which one you hit. A type error saying "two different types with this name exist but they are unrelated" is the duplicate-instance case. An `ERESOLVE` or `unmet peer dependency` error is the hard-failure case.

## How to find the duplicate

```
npm ls <library>          # or: pnpm why <library>, yarn why <library>
```

This prints the tree of who asked for what. Look for two entries under the same name with different versions. Note the path leading to each one. You need both paths for the fix.

## How to fix it, in the order to try

**Update the older requester.** Check whether the package pinning the old version has a newer release that accepts the new range. If it does, upgrade it. This fix removes the conflict instead of papering over it. Read the changelog of the requester, not the library.

**Deduplicate.** Sometimes the ranges do overlap and the tree got messy. Then `npm dedupe` or `pnpm dedupe` collapses them. A series of incremental installs is what produces that mess.

**Force a single version.** Every package manager has a mechanism:

- pnpm: `pnpm.overrides` in `package.json`
- npm: `overrides`
- yarn: `resolutions`

This tells the resolver to install one version no matter what anyone asked for. It works, and it lies to your dependencies. The lie is safe when the gap is a patch or a minor and the library follows semver. It is risky across a major. One of the two packages then runs against an API it was never tested on. If you do this, pin the exact version, comment which conflict it resolves, and plan to remove it.

**Declare it a peer dependency.** Some libraries must be a singleton: React, a state store, an ORM client, anything holding module-level state. For those, both packages should declare the library as a peer dependency instead of a direct one. The application then installs it once and both packages borrow it. If you own one of the two packages, make this change there.

## The part worth internalizing

Libraries holding global state cannot tolerate duplicates. Libraries that are pure functions can. React, `graphql`, `zod` schemas crossing a boundary, and anything doing `instanceof` checks belong to the first group. A date formatter or a lodash utility belongs to the second. That distinction tells you whether a duplicate is a correctness bug or a size problem.
