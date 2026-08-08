---
kind: eval-artifact
run: 2
variant: E
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for different versions of the same library, and only one version can win at the top of the tree.

Here is what happens under the hood. Your package manager tries to hoist one copy of a shared dependency to the root `node_modules`. When the version ranges overlap, it picks one copy and both packages use it. When the ranges do not overlap, it installs a second copy nested under the package that needs it. Either outcome can break you.

Two failure shapes show up:

- **Type errors.** TypeScript resolves the library's types once, and the hoisted version does not match what your code was written against.
- **Runtime "instanceof" or singleton bugs.** Two copies load, so two separate module instances exist. Class checks fail, React hooks throw "invalid hook call", and module-level state splits in half.

Run this first to see the truth:

```bash
pnpm why <library-name>
```

That prints every package asking for the library and the version each one got.

Then pick a fix:

1. **Align the ranges.** Ask the other team to widen or bump their range so both packages accept one version. This is the real fix.
2. **Pin it yourself.** Add a `pnpm.overrides` entry in the root `package.json` to force one version everywhere. This unblocks you today but hides a genuine incompatibility, so leave a comment saying why.
3. **Make it a peer dependency.** If the library must be a singleton, both packages should declare it in `peerDependencies` and let the app supply the one copy.

Start with `pnpm why`. The output usually names the culprit in one line.
