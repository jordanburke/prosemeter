---
kind: eval-artifact
run: 1
variant: G
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for different versions of the same library, and the resolver can only pick one winner per spot in the tree.

Here's the shape of it. The new package pulls in, say, `zod@4`. Your package still asks for `zod@3`. If the version ranges overlap, the package manager flattens them into one copy — and one of you gets a version you never tested against. If they don't overlap, you get two copies, and now the `Foo` type from one copy is not the `Foo` type from the other. That second case is why you often see a type error that reads like nonsense: "Type 'Schema' is not assignable to type 'Schema'."

**Find out which case you're in first:**

```bash
pnpm why <library>        # shows who asks for what
pnpm ls <library> --depth Infinity
```

If you see two versions listed, it's the duplicate-copy problem. If you see one version and a range that surprises you, it's the flattening problem.

**Then pick a fix:**

1. **Align the versions.** Best fix by far. Bump whoever is behind so both packages want the same major. Costs the most work up front and saves the most later.

2. **Make it a peer dependency.** If the library holds shared state or shared types — a schema lib, React, a logging singleton — the consumer should own the version. Move it to `peerDependencies` in both packages and declare it once at the app level. This turns "silent duplicate" into "loud install warning", which is what you want.

3. **Force one version.** In `pnpm-workspace.yaml`:

   ```yaml
   overrides:
     zod: ^4.0.0
   ```

   Fast, and it unblocks you today. It also lies to the package that wanted the old version, so only do this when you've checked the changelog and know the old caller still works.

I'd reach for 1, fall back to 2 if the library is stateful, and use 3 only as a stopgap with a ticket attached. Send me the `pnpm why` output and I'll tell you which one this is.
