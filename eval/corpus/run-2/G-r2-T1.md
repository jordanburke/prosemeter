---
kind: eval-artifact
run: 2
variant: G
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for different versions of the same library, and the package manager can only hoist one of them to the top of `node_modules`.

Here is what happens. The new package pulls in, say, `zod@4`. Your package already used `zod@3`. The resolver puts one version at the root and nests the other one deeper. Code that imports the library may get either copy, depending on where it sits in the tree.

Two copies break things in ways a version bump alone would not:

- **Type errors.** TypeScript sees two `Zod` types with the same shape but different identities, so it refuses to treat them as the same type. This is the classic "Type 'X' is not assignable to type 'X'" message.
- **Failed `instanceof` checks.** An object made by copy A is not an instance of the class from copy B.
- **Broken singletons.** Module-level state, like a registry or a plugin list, now exists twice.

To fix it, pick one version and make everyone use it. In rough order of preference:

1. **Align the ranges.** Bump your package to the same major the other team uses, or ask them to hold at yours. This is the real fix.
2. **Pin it in the workspace.** In pnpm, add an `overrides` block in the root `package.json`. npm calls this `overrides` too; yarn calls it `resolutions`. This forces a single version for the whole tree.
3. **Make it a peer dependency.** If your package is a library, move the shared library to `peerDependencies` so the consumer owns the version. This stops your package from dragging in its own copy.

To confirm the diagnosis first, run `pnpm why <library>`. It prints every path that asks for the library and the version each path got. If you see two versions, that is your bug.

One caveat on overrides: they force a version the other package never tested against. Use them to unblock yourself today, then land the range alignment.
