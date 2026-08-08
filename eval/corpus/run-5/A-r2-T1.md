---
kind: eval-artifact
run: 5
variant: A
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages in the dependency tree now want incompatible versions of the same library, and the package manager could not collapse them into a single install that satisfies both.

## What is actually happening

A package manager resolves every dependency's version range against every other one. When two ranges overlap, it picks one version and both packages share it. When they do not overlap — say one package requires `^3.0.0` and the new one requires `^5.0.0` — the manager has two options, and both can break a build.

**Option one: it installs both copies.** npm and pnpm will happily nest a second copy of the library deeper in `node_modules`. Nothing errors at install time. Things break later, at runtime or at type-check time, in ways that look unrelated to versions:

- Type errors like `Type 'Foo' is not assignable to type 'Foo'` — the same name, two different declaration files, so TypeScript treats them as unrelated types.
- `instanceof` checks failing, because the class object from copy A is not the class object from copy B.
- Singletons that stop being single. Anything holding module-level state — a React context, a connection pool, a plugin registry, an event bus — now exists twice, and half your code talks to the wrong instance.
- Bundle size roughly doubling for that library.

**Option two: it refuses.** Yarn's `peerDependency` errors and pnpm's stricter resolution will just fail the install or the build, which is honestly the friendlier outcome because it tells you the truth immediately.

Peer dependencies are the usual aggravating factor. If the library is something like React, or a plugin host, it is normally declared as a peer dependency precisely because there must be exactly one copy. A peer range mismatch between the two packages is what produces the `ERESOLVE` wall of text.

## How to see it

Find out who wants what before you change anything:

```bash
npm ls <library>          # or
pnpm why <library>        # or
yarn why <library>
```

That prints the tree of requesters and the version each one asked for. You are looking for two branches with disjoint ranges.

## How to fix it

In rough order of preference:

**1. Upgrade the lagging package.** Usually the cleanest fix. If the older package has a newer release that widens its range to include version 5, upgrade it and the conflict evaporates. Check its changelog first.

**2. Move the library to a shared direct dependency.** If both packages declare it as a peer, install a single version yourself at the top level in a range both accept. This makes the shared copy explicit rather than incidental.

**3. Force a single version.** Every manager has an escape hatch:

- pnpm: `"pnpm": { "overrides": { "lib": "5.2.0" } }`
- npm: `"overrides": { "lib": "5.2.0" }`
- Yarn: `"resolutions": { "lib": "5.2.0" }`

This is a real fix when the version ranges are pessimistic — a library declared `^3.0.0` often works fine on 5.x — and a lie when they are not. Test the package whose range you overrode. If it breaks, you have swapped a build error for a runtime one.

**4. Accept two copies.** Legitimate when the library holds no shared state and is not a peer dependency — a date formatter, a small utility. You pay bundle size and nothing else. Do not do this for anything with a registry, a context, or a singleton.

**5. Hold the new package back.** If the upgrade is not urgent and the conflict is deep, pinning the new package to a version compatible with your existing tree buys time.

## Preventing the next one

Adopting a monorepo-wide catalog (pnpm's `catalog:` protocol, or Yarn constraints) forces one version of shared libraries across all workspaces. It converts this class of failure from a surprise at install time into a policy decision you make on purpose.
