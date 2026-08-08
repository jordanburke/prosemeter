---
kind: eval-artifact
run: 2
variant: E
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now want different versions of the same library, and the resolver can only pick one.

Here is what happens under the hood. The new package declares a version range that does not overlap with yours. Your package manager either hoists one version and hands it to both packages, or it installs both copies in different places. Hoisting breaks types, because the compiler now sees a library whose shape does not match what your code expects. Two copies break runtime, because `instanceof` checks fail and module-level state like a client registry or a React context exists twice.

Start by finding out which versions are actually installed:

```bash
pnpm why <library>
```

That prints every package asking for it and the version each one got. The output tells you which of the two problems you have.

Then pick a fix:

1. **Align the ranges.** Bump your package to a version compatible with theirs, or ask them to widen their range. This is the real fix, so try it first.
2. **Force one version** with a `pnpm.overrides` entry in the root `package.json`. This works when the versions are compatible in practice and the range is just too strict. Add a comment saying why, because overrides silently mask future breaks.
3. **Move the library to a peer dependency** in both packages, and pin it once in the app. Do this for anything that must be a singleton: React, the GraphQL client, anything holding module state.

If the two versions are genuinely incompatible, the only honest fix is one team upgrading. Overrides will paper over it and fail later in a much worse place.
