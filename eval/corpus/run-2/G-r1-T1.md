---
kind: eval-artifact
run: 2
variant: G
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for different versions of the same library, and the resolver can't pick one that satisfies both.

Here's what happens under the hood. The package manager tries to hoist one copy of a shared library to the top of `node_modules`. When the version ranges overlap, it picks the highest match and everyone is happy. When they don't overlap, it either installs two copies at different depths or fails outright. Two copies is the sneaky case: your code loads one, the new package loads the other, and any type or `instanceof` check across that line fails. That's why the error often looks like a type mismatch rather than a version fight.

To confirm it, run this:

```bash
pnpm why <library-name>
```

That prints every package that depends on it and the range each one asks for. Look for two ranges that don't overlap.

You have four fixes, in the order I'd try them:

1. **Bump the older dependent.** If the package pinning the old version has a newer release that moved to the new one, upgrade it. This is the real fix, so try it first.
2. **Add a `resolutions` / `pnpm.overrides` entry.** This forces one version for the whole tree. It works when the two versions are actually compatible and the range is just too strict. Add a comment saying why, or nobody will remember.
3. **Make the library a peer dependency.** If it's a library that breaks when duplicated — React, a state store, anything with module-level state — the owning package should list it as a peer, not a direct dependency. Then the app picks one copy.
4. **Live with two copies.** This is fine for a leaf utility with no shared state. It costs bundle size and nothing else.

Skip `--legacy-peer-deps` and `--force`. They silence the warning and leave you with the broken tree.

One caution on overrides: you are telling the resolver that a package's stated range is wrong. Sometimes it is wrong, and sometimes the package really does break on the version you forced. Run the tests for the overridden package's code path before you ship it.
