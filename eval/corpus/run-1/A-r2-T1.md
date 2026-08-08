---
kind: eval-artifact
run: 1
variant: A
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: major
  foundBy: "opus"
  error: "Claims a resolver hoists one version and gives it to a package whose declared range excludes it. Resolvers nest a second copy instead."
---
What you're hitting is a **version conflict in the dependency graph**, and it's worth understanding the mechanics before reaching for a fix.

When the other team added their package, it pulled in a dependency — say `some-lib` — at a version range that doesn't overlap with the range your package already had. Your package manager now has to decide what to install. Depending on the manager and the situation, one of two things happens:

1. **It installs both copies** (npm/pnpm will nest a second copy under the dependent that needs it). Nothing errors at install time, but now you have two distinct module instances at runtime. That breaks anything relying on identity — `instanceof` checks, singletons, React context, a shared registry, a `Symbol` cache. Also bloats the bundle.
2. **It hoists one version and both packages share it.** Whichever package didn't want that version now gets an API it wasn't written against, and you get a type error at build time or a `TypeError: x.foo is not a function` at runtime.

Your build breaking suggests #2 (or #1 with TypeScript seeing two different sets of declaration files, which produces those wonderfully confusing "Type 'Foo' is not assignable to type 'Foo'" errors).

**First step — see the actual shape of it:**

```bash
pnpm why some-lib      # or: npm ls some-lib / yarn why some-lib
```

That prints every path in the tree that pulls the library in and at what version. Don't skip this; the fix depends entirely on whether the two ranges are *compatible-but-unhoisted* or *genuinely incompatible*.

**Then, in rough order of preference:**

**Bump the loser.** If one package's range is just stale and the newer version satisfies both, upgrade it. Cleanest outcome, no config debt. Check the lib's changelog for breaking changes between the two versions first.

**Dedupe.** If the ranges already overlap and the tree just failed to collapse them, `pnpm dedupe` (or `npm dedupe`) will consolidate. This is common after a lockfile merge where two branches resolved the same range to different exact versions.

**Override / resolution.** If a transitive dep is pinned to something old and you can't upgrade it, force the version:

```jsonc
// package.json — pnpm
"pnpm": { "overrides": { "some-lib": "^5.2.0" } }

// npm
"overrides": { "some-lib": "^5.2.0" }

// yarn
"resolutions": { "some-lib": "^5.2.0" }
```

This is a real fix but it's also a lie you're telling the resolver — you're asserting the pinned package works with a version it never declared support for. Leave a comment saying why, and link an upstream issue if you filed one.

**Make it a peer dependency.** If `some-lib` is the kind of library that *must* be a singleton (React, a state store, an ORM client, anything with module-level state), the right long-term shape is for both packages to declare it as a `peerDependency` rather than a regular `dependency`. That pushes the version decision up to the app, where it belongs, and makes duplication an explicit install-time warning instead of a silent runtime bug.

**One thing to check regardless:** if this is a monorepo, make sure both packages are actually resolving through the workspace root and not each carrying their own `node_modules` copy. That's the usual culprit for "it works in CI but not locally" versions of this.

If you paste the `pnpm why` output I can tell you which branch you're in.
