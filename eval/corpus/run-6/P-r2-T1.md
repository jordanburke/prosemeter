---
kind: eval-artifact
run: 6
variant: P
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Two packages in your tree now ask for versions of the same library that do not overlap. The package manager cannot satisfy both with one install, so it either nests two copies or refuses outright. Both outcomes break a build.

## What is actually happening

A package manager compares every dependency's version range against every other one. When ranges overlap, it picks one version and both packages share it. When they do not overlap — one package wants `^3.0.0`, the new one wants `^5.0.0` — it has two choices.

**It installs both copies.** npm and pnpm nest a second copy deeper in `node_modules`. Install succeeds. The break comes later, at runtime or type-check, and it looks nothing like a version problem:

- Type errors reading `Type 'Foo' is not assignable to type 'Foo'`. Same name, two declaration files, so TypeScript treats them as unrelated types.
- `instanceof` returning false, because the class object from copy A is not the class object from copy B.
- Singletons that stop being single. Anything holding module-level state — a React context, a connection pool, a plugin registry, an event bus — now exists twice, and half your code talks to the wrong one.
- Bundle size roughly doubling for that library.

**It refuses.** Yarn peer-dependency errors and pnpm's stricter resolution fail the install instead. That is the friendlier outcome, because it tells you the truth immediately.

Peer dependencies usually make it worse. A library like React, or any plugin host, is declared as a peer precisely because there must be exactly one copy. A peer range mismatch between two packages produces the `ERESOLVE` wall of text.

## How to see it

Find out who wants what before changing anything:

```bash
npm ls <library>          # or
pnpm why <library>        # or
yarn why <library>
```

That prints every requester and the version each asked for. Look for two branches with disjoint ranges.

## How to fix it

In rough order of preference:

**1. Upgrade the lagging package.** Usually the cleanest fix. If the older package has a release that widens its range to include version 5, upgrade it and the conflict disappears. Read its changelog first.

**2. Move the library to a shared direct dependency.** If both packages declare it as a peer, install one version yourself at the top level, in a range both accept. The shared copy becomes explicit rather than incidental.

**3. Force a single version.** Every manager has an escape hatch:

- pnpm: `"pnpm": { "overrides": { "lib": "5.2.0" } }`
- npm: `"overrides": { "lib": "5.2.0" }`
- Yarn: `"resolutions": { "lib": "5.2.0" }`

This is a real fix when the ranges are pessimistic — a library declaring `^3.0.0` often runs fine on 5.x — and a lie when they are not. Test the package whose range you overrode. If it breaks, you traded a build error for a runtime one.

**4. Accept two copies.** Fine when the library holds no shared state and is not a peer dependency: a date formatter, a small utility. You pay bundle size and nothing else. Never do this for anything with a registry, a context, or a singleton.

**5. Hold the new package back.** If the upgrade is not urgent and the conflict runs deep, pin the new package to a version your existing tree accepts. That buys time.

## Preventing the next one

A monorepo-wide catalog — pnpm's `catalog:` protocol, or Yarn constraints — forces one version of each shared library across all workspaces. It turns this failure from an install-time surprise into a policy decision you make on purpose.
