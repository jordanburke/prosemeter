---
kind: eval-artifact
run: 6
variant: P
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Two packages in your tree ask for different versions of the same library, and the package manager could not pick one version that satisfies both. What breaks next depends on how the manager reacted.

## Why the build broke

Three failure shapes cover almost every case, and each looks different in the error output.

**Two copies got installed.** npm, pnpm, and yarn usually resolve a conflict by nesting: package A gets `lib@1`, package B gets `lib@2`, and both sit in the tree. The install succeeds. The build breaks because your code assumes one copy. The tells are `instanceof` returning false, a singleton that is now two singletons, React's "invalid hook call", duplicate class registration, or TypeScript refusing to assign two structurally identical types to each other.

**One copy got hoisted, and it is the wrong one.** When the two ranges overlap enough to pick a single version, one package runs against a version it was not written for. You get `TypeError: x.y is not a function`, or a missing export.

**The install itself failed.** npm 7+ and pnpm enforce peer dependencies. If the new package declares `peerDependencies: { lib: "^2" }` and you are on `lib@1`, the install errors instead of guessing.

## Find out which one you have

Ask the manager to print the tree for that library.

```
npm ls <library>
pnpm why <library>
yarn why <library>
```

The output lists every version present and the package that pulled each one in. That tells you whether you have one copy or several, and which dependency holds the old range.

## How to fix it

Work down this list. Stop at the first option that applies.

**Upgrade the package that is behind.** If the older constraint comes from a dependency that has since shipped support for `lib@2`, bump it. This is the real fix, and the only one that leaves no residue.

**Move your own direct dependency.** If your `package.json` pins the version that conflicts, change it to a range both packages accept.

**Force a single version.** Every manager has an override:

```jsonc
// npm
"overrides": { "lib": "2.3.0" }

// pnpm
"pnpm": { "overrides": { "lib": "2.3.0" } }

// yarn
"resolutions": { "lib": "2.3.0" }
```

This collapses the tree to one copy. It is a real fix when the two ranges are compatible in practice and the lower bound was just conservative. It is a lie to the resolver when they are not, and it turns an install error into a runtime error. Use it only after checking that the package with the older range works against the newer library.

**Make the library a peer dependency.** If the library must be a singleton — React, a state store, a driver holding a connection pool — the packages that use it should declare it as a peer rather than a regular dependency. That pushes the choice up to the application and surfaces the constraint at install time instead of at runtime. If one of those packages is yours, fix it there.

## Preventing the next one

Two copies of a stateless utility cost you bundle size. Two copies of a library that holds state cost you correctness, and the bug will make no sense when it lands. For libraries in that second group, add a CI check — `npm ls <library>` exiting non-zero is enough — so a duplicate fails the build the day it appears rather than three weeks later.
