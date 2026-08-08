---
kind: eval-artifact
run: 1
variant: C
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your tree now holds two copies of the same package. Yours pins `^2.x`, theirs pins `^3.x`, and the installer keeps both. Node then loads whichever copy sits closest to each importer.

That is fine right up until the two copies have to talk. Types from copy A do not match types from copy B, so TypeScript yells. At runtime, `instanceof` checks fail for the same reason — to Node, those are two different classes. Anything that expects one shared instance (a client, a cache, a React context) quietly splits in two.

**Find it first:**

```bash
pnpm why <package-name>
```

That prints every path pulling it in, plus the range each parent asks for.

**Then fix it, best option first:**

1. **Make the ranges overlap.** Bump the older package until it takes v3, or ask the other team to hold at v2. One copy, real fix, done.
2. **Hoist it to a peer dep.** If the package must be a singleton, list it under `peerDependencies` in your workspace packages and install it once at the root. Now the graph can only ever have one.
3. **Force it with an override.** In the root `package.json`:

   ```json
   "pnpm": { "overrides": { "some-lib": "3.1.0" } }
   ```

   Do this only when the two majors really do act alike for the parts you touch. Else you swap a build error for a runtime one, which is a worse trade.
4. **Leave it alone.** If nothing crosses between the two consumers, two copies are safe. You just pay in bundle size.

Skip step 3 if the changelog shows a break in code you call. Read it before you pin.
