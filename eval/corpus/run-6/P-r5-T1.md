---
kind: eval-artifact
run: 6
variant: P
replicate: r5
task: T1
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Two packages ask for versions of the same library that the package manager cannot merge into one install. That is the whole problem. The build is where you see it; resolution is where it happened.

## What is actually happening

A package manager wants one copy of each library. When the requested version ranges overlap, it picks a version inside both and everyone shares it. When they do not overlap, it has two options, and both break builds.

**It installs both copies, nested.** npm and pnpm do this. Your build now holds two module instances of one library. The code compiles, then anything relying on identity across the boundary fails: `instanceof` returns false, singletons stop being single, React throws "invalid hook call", providers stop matching consumers. The library's share of the bundle roughly doubles.

**Or it refuses.** You get this from peer dependencies, from pnpm's stricter resolution, or from a lockfile that cannot be updated without breaking a constraint. The error names both requesters and their ranges.

Your error message says which one you hit. "Two different types with this name exist but they are unrelated" is the duplicate-instance case. `ERESOLVE` or `unmet peer dependency` is the refusal case.

## Find the duplicate

```
npm ls <library>          # or: pnpm why <library>, yarn why <library>
```

That prints who asked for what. Look for the same name at two versions, and note the path to each — the fix needs both paths.

## Fix it, in this order

**Update the older requester.** If the package pinning the old version has a release that accepts the new range, upgrade it. This is the only fix that removes the conflict instead of hiding it. Read the requester's changelog, not the library's.

**Deduplicate.** If the ranges do overlap and the tree merely got messy, `npm dedupe` or `pnpm dedupe` collapses them. A series of incremental installs produces this state often.

**Force one version.** Every package manager offers a lever:

- pnpm: `pnpm.overrides` in `package.json`
- npm: `overrides`
- yarn: `resolutions`

The resolver then installs exactly one version whatever anyone asked for. It works, and it lies to your dependencies. It is safe across a patch or a minor when the library follows semver. It is risky across a major, because one package now runs against an API nobody tested it on. If you do it, pin an exact version, leave a comment naming the conflict, and plan the removal.

**Make it a peer dependency.** Some libraries must be singletons — React, a state store, an ORM client, anything holding module-level state. For those, both packages should declare the library as a peer dependency rather than a direct one. The application then installs it once and both packages borrow it. Make that change in whichever package you own.

## The part worth keeping

Libraries holding global state cannot tolerate duplicates. Libraries that are pure functions usually can. React, `graphql`, `zod` schemas crossing a boundary, and anything doing `instanceof` sit in the first group. A date formatter or a lodash utility sits in the second. That split tells you whether a duplicate is a correctness bug or only a size problem, and therefore how hard to fight it.
