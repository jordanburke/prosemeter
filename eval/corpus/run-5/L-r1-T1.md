---
kind: eval-artifact
run: 5
variant: L
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages want different versions of the same library, and only one version can win at a given spot in the tree. Pick one version and force everyone onto it.

Here is what is happening. Your package manager builds a dependency tree. When two packages ask for versions that overlap, it hoists one shared copy and both use it. When the ranges do not overlap, it installs both — one at the top, one nested under the package that needs it. Your build then sees two copies.

Two copies break things in ways a version bump alone would not. Types stop matching, because TypeScript treats the two copies as unrelated types even when they look identical. Instance checks fail, because a class from copy A is not the same class as copy B. Singletons split, so a library that keeps a registry or a React context now keeps two, and half your app reads the wrong one.

Find the duplicate first:

```
npm ls <library>          # or: pnpm why <library>, yarn why <library>
```

That prints who asks for what. The output names the two packages and the two ranges.

Then fix it, in this order of preference.

**Upgrade the lagging package.** If the older dependent has a newer release that accepts the newer library version, upgrade it. This is the real fix, because nothing is pinned by hand and nothing drifts later.

**Force one version.** If no upgrade exists, override the range yourself. npm and yarn call it `overrides`/`resolutions`; pnpm uses `pnpm.overrides`:

```json
{ "overrides": { "<library>": "2.4.1" } }
```

You are asserting the older package works against the newer library. Test that claim. Read the library's changelog for the range you skipped, and run the tests that touch the older package.

**Make the library a peer dependency.** If you own the packages, declare the shared library as a `peerDependency` instead of a `dependency`. The consumer then supplies one copy, and the package manager warns you when versions conflict rather than silently installing two.

One thing to check before you start. If the library is meant to be a singleton — React, a state store, a plugin registry — treat duplication as the bug even when the build passes. Two copies of React will not throw at install time. They throw a hook error at runtime, weeks later.
