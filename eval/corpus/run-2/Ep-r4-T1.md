---
kind: eval-artifact
run: 2
variant: Ep
replicate: r4
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for different versions of the same library, and the resolver can only put one of them where your code looks for it.

Here is what happens under the hood. The package manager builds one tree from everyone's version ranges. When the ranges overlap, it picks a single version and both packages share it. When the ranges do not overlap, it installs two copies — one at the top level, one nested under the package that needs the odd version.

Two copies break things in ways a version bump normally does not:

- **Type errors.** TypeScript sees two separate declarations of the same class, so `Foo` from copy A is not assignable to `Foo` from copy B.
- **`instanceof` failures.** Objects made by copy A fail `instanceof` against copy B's constructor.
- **Broken singletons.** Anything holding module-level state — a React context, a DI container, a registry — now exists twice, and half your code talks to the wrong one.
- **Bundle bloat.** You ship both copies to the browser.

To fix it, first find out what you actually have:

```bash
pnpm why <library>
```

That prints every package asking for it and which version each one got. Then pick one of these, in order of preference:

1. **Align the ranges.** Bump the older package until both accept one version. This is the real fix, so try it first.
2. **Hoist to a single version.** Add a `pnpm.overrides` entry pinning the library to one version for the whole tree. Do this only when the two versions are actually compatible — an override on a real breaking change trades a build error for a runtime one.
3. **Make it a peer dependency.** If the library must be a singleton, the packages should declare it as a peer and let your app own the version. Say so in an issue on the package that hard-depends on it.

For a monorepo, `pnpm dedupe` after aligning the ranges cleans up leftovers. If the odd version comes from a package you own, fix it there rather than papering over it with an override.
