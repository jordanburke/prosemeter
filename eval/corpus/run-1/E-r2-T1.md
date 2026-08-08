---
kind: eval-artifact
run: 1
variant: E
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because the dependency tree now holds two copies of the same library, and something in your code expects only one.

Here is what happened. The new package asked for a different version range than yours did. The package manager could not find one version that satisfies both, so it installed both — one at the top level, one nested inside the package that needed it. Now the same module gets loaded twice, under two paths, with two separate copies of its state and its classes.

That breaks things in three common ways:

- **Type errors at build time.** TypeScript sees two `Foo` types from two paths and refuses to treat them as the same type, even when they look identical.
- **`instanceof` checks failing at runtime.** An object built by copy A is not an instance of the class from copy B.
- **Singleton state splitting.** Libraries that keep a registry or a global cache — React, a DI container, a config store — now keep two, and neither sees the other's entries.

To confirm it, run `pnpm why <library>`. That prints every package asking for it and the version each one got. Two versions in that output is your answer.

To fix it, pick one of these:

1. **Align the ranges.** Bump the older package's dependency so both land on one version. This is the real fix when you control both packages.
2. **Add an override.** Put the library under `pnpm.overrides` in the root `package.json` and pin one version for the whole workspace. Do this when you do not control the other package. Check the changelog first — you are forcing a version its author did not test against.
3. **Make it a peer dependency.** If the library must be a singleton, both packages should declare it under `peerDependencies` and let the app supply the one copy. This is the right shape for things like React and its ecosystem.

Start with option 1. Fall back to option 2 if the other team cannot move quickly, and leave a TODO so the override does not outlive the reason for it.
