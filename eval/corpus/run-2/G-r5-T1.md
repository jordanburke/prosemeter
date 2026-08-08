---
kind: eval-artifact
run: 2
variant: G
replicate: r5
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for different versions of the same library, and your bundler can only pick one.

Here is what happens. The new package pulls in, say, `zod@4`. Your package already used `zod@3`. The package manager either hoists one version to the top and gives both packages that one, or it installs both copies in nested folders. Either outcome breaks you. If it hoists, one of the two packages gets a version it was not written against, and you see type errors or runtime crashes. If it nests, you end up with two copies of the library in memory, and any `instanceof` check or shared registry across the boundary fails, because the classes come from different copies.

The tell for the second case is an error that reads like nonsense, such as "expected a Schema but got a Schema."

To fix it, first find out which case you are in:

```bash
pnpm why <library-name>
```

That prints every package that depends on the library and the version each one resolved to.

Then pick one of these:

1. **Best fix: agree on one version.** Bump the lagging package so both ask for the same major. This is the only fix that removes the problem instead of hiding it.
2. **Force it with an override.** Add the library to `pnpm.overrides` in the root `package.json`. This pins one version for the whole tree. Only do this when you have checked that both packages actually work on that version, since you are overruling what they declared.
3. **Make it a peer dependency.** If the library is meant to be shared, such as React or a schema library, both packages should list it under `peerDependencies` and let the app supply it. That way the tree can only ever hold one copy.

For this repo, option 1 or 3 is almost always right. Overrides are a stopgap, so if you use one, leave a comment saying why and what needs to happen to remove it.
