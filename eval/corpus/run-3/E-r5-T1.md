---
kind: eval-artifact
run: 3
variant: E
replicate: r5
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for different versions of the same library, and only one version can win at a given spot in the tree.

Here is what happens. The new package pulls in, say, `zod@4`. Your package already depends on `zod@3`. The installer hoists one of them to the root `node_modules` and nests the other underneath. Types from the two copies do not match, so TypeScript complains that `ZodType` is not assignable to `ZodType`. At runtime you can get the same bug in a different costume: two copies of a library means two module registries, two class identities, two `instanceof` checks that fail.

Check what you actually have:

```bash
pnpm why zod
pnpm list zod --depth Infinity
```

Fix it in this order.

**Align the versions.** Best fix by far. Bump the lagging package so both depend on the same major. This removes the duplicate instead of hiding it.

**Pin it with an override** if you cannot bump right away. In the root `package.json`:

```json
{
  "pnpm": {
    "overrides": {
      "zod": "^4.0.0"
    }
  }
}
```

This forces one copy for the whole workspace. It is a lie you are telling the resolver, so it only works when the versions are actually compatible. Read the changelog first.

**Make it a peer dependency** if the library carries identity that must be shared — React, a validation library whose schemas cross package boundaries, anything with `instanceof` or a global registry. Move it to `peerDependencies` in the packages that use it, and let the app pick the single version.

One more thing. Delete `node_modules` and the lockfile entry before you re-test, or you will debug a stale tree. `pnpm install --force` is usually enough.
