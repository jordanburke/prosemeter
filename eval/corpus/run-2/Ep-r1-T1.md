---
kind: eval-artifact
run: 2
variant: Ep
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two copies of that library now exist in the tree, and something in your code assumes there is only one.

The package manager keeps one version at the top of `node_modules` and nests the other under whichever package asked for it. Both copies load fine on their own. They break when the library holds state that has to be shared — a React instance, a DI container, a class used in an `instanceof` check, a registry of plugins. Code that got copy A hands an object to code that expects copy B, and the check fails. If the library is a type-only or build-time dependency, you get the same clash as a TypeScript error instead, because the two `.d.ts` files declare different shapes for the same name.

To confirm it, run `pnpm why <library>`. That prints every package asking for it and the version each one got. Two versions in that output is your answer.

Three fixes, in the order I would try them:

1. **Bump the lagging package.** If the other team moved to `^3` and you are on `^2`, upgrade yours so the ranges overlap and the manager dedupes to one copy. This is the real fix.
2. **Force one version** with a `pnpm.overrides` entry in the root `package.json`. Do this only when the two versions are actually compatible — you are overruling a package's stated requirement, so read the changelog for breaking changes first.
3. **Make it a peer dependency** in the packages that must share the instance. That pushes the choice up to the app and makes a future mismatch a loud install warning instead of a confusing runtime bug.

Skip all three if the library holds no shared state. Two copies of a pure utility like `date-fns` cost you bundle size and nothing else, so leave it alone and fix the ones that actually collide.
