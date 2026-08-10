---
kind: eval-artifact
run: 6
variant: R
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-10
note: "revision arms — blind vs findings-guided"
warning: Experiment output, not reference material. Generated to measure a revision procedure, never fact-checked as documentation.
---

Two packages ask for different versions of the same library. The package manager found no single version that satisfies both. What happens next depends on the manager and on where the conflict sits.

## Why the build broke

Three failure shapes are common. Each looks different in the error output.

**Two copies got installed.** npm, pnpm, and yarn resolve this by nesting. Package A gets `lib@1`, package B gets `lib@2`, and both live in the tree at once. The install succeeds. The build then breaks, because your code was written for one copy. Classic symptoms: `instanceof` returns false, one singleton becomes two, React throws "invalid hook call", a class registers twice. TypeScript reports two identical types that are not assignable to each other.

**One copy got hoisted, and it is the wrong one.** The ranges overlap, so the manager picks a single version. One package now runs against a version it was not written for. You get `TypeError: x.y is not a function`, or a missing export.

**The install itself failed.** npm 7+ and pnpm enforce peer dependencies. If the new package declares `peerDependencies: { lib: "^2" }` and you are on `lib@1`, the install errors out instead of guessing.

## How to see which one you have

Ask the package manager to print the tree for that library.

```
npm ls <library>
pnpm why <library>
yarn why <library>
```

The output shows every version present. It also shows which package pulled each one in. That tells you how many copies you have, and which dependency holds the old range.

## How to fix it

Work down this list. Stop at the first option that applies.

**Upgrade the package that is behind.** The older constraint may come from a dependency that has since released a version supporting `lib@2`. Bump it. This is the real fix, and the only one that leaves no residue.

**Change your own direct dependency.** If your `package.json` pins the version that conflicts, move it to the range both packages accept.

**Force a single version.** Every manager has an override mechanism:

```jsonc
// npm
"overrides": { "lib": "2.3.0" }

// pnpm
"pnpm": { "overrides": { "lib": "2.3.0" } }

// yarn
"resolutions": { "lib": "2.3.0" }
```

This collapses the tree to one copy. It is a real fix when the two ranges work together in practice and the version bound is conservative. It is a lie to the resolver when they do not. Then it converts an install error into a runtime error. Use it only after you check that the package with the older range runs against the newer library.

**Make the library a peer dependency.** Some libraries must be a singleton — React, a state store, a database driver holding a connection pool. Packages that use one should declare it as a peer dependency, not a regular one. That pushes the choice up to the application. It also makes the constraint visible at install time instead of at runtime. If one of those packages is yours, fix it there.

## Preventing the next one

Two copies of a stateless utility library is a bundle-size problem. Two copies of a library that holds state is a correctness problem. It will surface as a bug that makes no sense. If you depend on libraries in the second category, add a check to CI. `npm ls <library>` exiting non-zero is enough. A duplicate then fails the build at once, not three weeks later.
