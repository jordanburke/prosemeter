---
kind: eval-artifact
run: 5
variant: F
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Two copies of the same library are now in your build, and something in your code is holding the wrong one. The new package asked for a different version than yours did, and the package manager could not settle on one that satisfies both.

## What is happening?

Your build has a **diamond dependency**: two packages depend on a third one, at versions that do not overlap.

Say your package needs `lib@2.x` and the new package needs `lib@3.x`. The package manager has two choices. It can install one copy that both share, which only works if their version ranges overlap. Or it can install both copies, nested, so each package gets what it asked for.

npm and pnpm install both copies by default. That usually works. It breaks in three cases:

- **Shared types.** A `Widget` from copy A is not a `Widget` from copy B. An `instanceof` check fails. A type error appears at a boundary that used to typecheck.
- **Shared global state.** A library that keeps a registry, a connection pool, or a React context in module scope now keeps two of them. Registration goes to one copy and lookup reads the other.
- **Peer dependencies.** React, the test runner, and most plugin systems declare a peer dependency because they need exactly one copy. Two copies produce errors like "invalid hook call" that name nothing useful.

Maven and Gradle behave differently. They pick one version and force it on everyone, so nothing is duplicated but the loser gets a version it never asked for. That shows up as a missing method at runtime, not a build error.

## How do I see which case I am in?

Ask the package manager to print the tree for that library:

```
npm ls <library>
pnpm why <library>
./gradlew dependencyInsight --dependency <library>
```

The output names every package that depends on it and the version each one got. If you see one entry, you have the forced-single-version case. If you see two, you have the duplicate case.

## How do I fix it?

Try these in order. The first one that works is the one to ship.

**Bump your side.** Move your package to the version range the new package wants. The ranges then overlap, the package manager installs one copy, and the problem is gone. This is the real fix and it usually costs an afternoon of reading a changelog.

**Bump their side.** If the new package is behind and yours is current, ask that team to upgrade. Same outcome, different owner.

**Force one version.** If neither can move today, tell the package manager to collapse to one copy:

- pnpm: an `overrides` block in the root `package.json`
- npm: `overrides`, same place
- Yarn: `resolutions`
- Gradle: a `resolutionStrategy.force`

This is a lie you are telling the build. One package now runs against a version it did not ask for. It works when the two versions differ by a patch or a minor with no relevant break. Test the forced package, and leave a comment saying when the override can come out.

**Move the library to a peer dependency.** If the library must be a singleton — React, a logger with global config, anything with module-level state — declare it as a peer dependency in both packages and a normal dependency once at the app root. The app then owns the version and both packages borrow it. This is the right shape for singletons, and it prevents the problem from coming back.

Do not delete the lockfile and reinstall. That reshuffles the tree and can hide the conflict for a build or two, which costs you the next person's afternoon instead of your own.
