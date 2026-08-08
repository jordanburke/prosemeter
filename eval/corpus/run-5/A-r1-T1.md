---
kind: eval-artifact
run: 5
variant: A
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Two packages in your dependency tree ask for different versions of the same library, and the package manager could not settle on one that satisfies both. What happens next depends on the manager and on where the conflict sits.

## Why the build broke

There are three common failure shapes, and they look different in the error output.

**Two copies got installed.** npm, pnpm, and yarn will usually resolve this by nesting: package A gets `lib@1`, package B gets `lib@2`, and both live in the tree at once. The install succeeds. The build then breaks because something in your code assumes there is only one copy. Classic symptoms are `instanceof` returning false, a singleton that is now two singletons, a React "invalid hook call" error, or duplicate class registration. TypeScript reports it as two structurally identical types that are not assignable to each other.

**One copy got hoisted and it is the wrong one.** If the two ranges overlap enough for the manager to pick a single version, one package ends up running against a version it was not written for. You get a runtime `TypeError: x.y is not a function`, or a missing export.

**The install itself failed.** Peer dependencies are strict in npm 7+ and in pnpm. If the new package declares `peerDependencies: { lib: "^2" }` and you are on `lib@1`, the install errors out rather than guessing.

## How to see which one you have

Ask the package manager to print the tree for that library.

```
npm ls <library>
pnpm why <library>
yarn why <library>
```

The output shows every version present and which package pulled each one in. That tells you whether you have one copy or several, and which dependency is holding the old range.

## How to fix it

Work down this list; stop at the first option that applies.

**Upgrade the package that is behind.** If the older constraint comes from a dependency that has since released a version supporting `lib@2`, bump it. This is the real fix and the only one that leaves no residue.

**Upgrade or downgrade your own direct dependency.** If your own `package.json` pins the version that conflicts, move it to the range both packages accept.

**Force a single version.** Every manager has an override mechanism:

```jsonc
// npm
"overrides": { "lib": "2.3.0" }

// pnpm
"pnpm": { "overrides": { "lib": "2.3.0" } }

// yarn
"resolutions": { "lib": "2.3.0" }
```

This tells the manager to collapse the tree to one copy. It is a real fix when the two ranges are compatible in practice and the version bound is just conservative. It is a lie to the resolver when they are not, and it converts an install error into a runtime error. Only use it when you have checked that the package with the older range actually works against the newer library.

**Make the library a peer dependency.** If the library must be a singleton — a React, a state store, a database driver holding a connection pool — the packages that use it should declare it as a peer dependency rather than a regular one. That pushes the choice up to the application and makes the constraint visible at install time instead of at runtime. If one of those packages is yours, fix it there.

## Preventing the next one

Two copies of a stateless utility library is a bundle-size problem. Two copies of a library that holds state is a correctness problem, and it will surface as a bug that makes no sense. If you have libraries in the second category, add a check to CI — `npm ls <library>` exiting non-zero is enough — so a duplicate fails the build immediately rather than three weeks later.
