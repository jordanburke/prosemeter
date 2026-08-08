---
kind: eval-artifact
run: 3
variant: A
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Short version: nothing is wrong with your code. The new package pulled in a version of a shared library that can't be reconciled with the one you were already on, so the package manager gave up on having one copy and installed two.

Here's the mechanic. When two packages ask for compatible ranges (`^2.1.0` and `^2.4.0`), the resolver picks a single version that satisfies both and everyone shares it. When the ranges don't overlap (`^2.x` and `^3.x`), it can't do that, so it hoists one copy to the top of `node_modules` and nests the other one inside the package that needs it. Both versions are now live in the same process.

That's usually fine — until the library has *identity*. Then it bites in a couple of specific ways:

- **`instanceof` and type checks fail.** A class from v2 is not the same class object as the one from v3, so `err instanceof LibError` returns false even though it looks like the right thing.
- **Module-level state gets duplicated.** Registries, singletons, React's hook dispatcher, context objects, connection pools — each copy has its own. This is the classic "Invalid hook call" / "two copies of React" error.
- **Type declarations collide.** TypeScript resolves the transitive dep's types against a different `.d.ts` than yours, and you get errors where structurally identical types don't unify.

First thing to do is see it rather than guess at it:

```bash
pnpm why <library>      # or: npm ls <library>
```

That prints the tree of who's asking for what. You'll usually see your version at the top and the other one nested under the new package.

Then, roughly in order of preference:

**1. Align the versions.** If the new package needs v3 and v3 isn't a huge lift for you, upgrade. One version in the tree is the only fix that's actually a fix; everything below is containment.

**2. Check whether it should be a peer dep.** If the library is one of those identity-carrying ones (React, a plugin host, an ORM), the new package is arguably buggy for depending on it directly instead of declaring it as a peer. Worth an issue upstream, and worth checking whether they already publish it as a peer and something in your setup is overriding that.

**3. Force a single copy.** pnpm has `overrides`, npm has `overrides`, yarn has `resolutions`:

```json
{
  "pnpm": {
    "overrides": {
      "<library>": "^3.0.0"
    }
  }
}
```

This makes everyone use one version whether they like it or not. It works surprisingly often, because most packages' declared ranges are more conservative than what they actually need. But you're overriding a constraint the author wrote deliberately, so exercise it and watch for runtime breakage rather than assuming the install succeeding means you're done.

**4. Live with two copies.** Legitimate if the library is a pure utility with no shared state and no `instanceof` across the boundary — lodash, date-fns, that sort of thing. You pay in bundle size and nothing else. Not viable for anything stateful.

One thing worth flagging to whoever added the package: if this is a monorepo, a duplicate that's harmless at build time can still be harmful in the bundle, and it won't show up in CI. Checking `pnpm why` after adding a dependency is a cheap habit.
