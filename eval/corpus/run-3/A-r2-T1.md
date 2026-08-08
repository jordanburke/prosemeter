---
kind: eval-artifact
run: 3
variant: A
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
What you're hitting is a version conflict in the dependency tree. Your package asks for `some-lib@^2`, the new package asks for `some-lib@^3`, and the installer has to decide what actually lands in `node_modules`.

Depending on the setup, one of two things happens, and they break differently:

- **Two copies get installed** (nested, or separate entries in the pnpm store). Nothing fails at install time, but you get weird runtime behavior: `instanceof` returns false against a class from the other copy, singletons aren't shared, a React or context-style library complains it's being used twice. Type errors also show up as "Type X is not assignable to type X" — same name, different declaration files.
- **One copy wins and gets hoisted** into a shared spot. Now one of the two packages is running against a version it never declared support for, and you get the missing-export or changed-signature errors.

First thing: find out which case you're in.

```bash
pnpm why some-lib      # npm ls some-lib / yarn why some-lib
```

That prints the tree and shows you who asked for what. It's usually obvious within a few seconds of reading it.

Fixes, roughly in order of how much I'd reach for them:

1. **Align the ranges.** If v3 is backwards-compatible enough, bump your package to `^3` and be done. This is the real fix and usually the cheapest one.
2. **If the other team can't move, or you can't**, and the two copies genuinely don't need to be the same instance, let them coexist. This is fine for a pure utility library (date formatting, a parser) and actively broken for anything stateful.
3. **Force a single version** with a resolutions/overrides field in the root `package.json`, if you know one version satisfies both:

   ```json
   "pnpm": { "overrides": { "some-lib": "3.2.0" } }
   ```

   This is a hammer. It silences the resolver, it doesn't make the code compatible — so verify both packages actually work against the pinned version rather than assuming.
4. **Peer-dependency it.** If `some-lib` is the kind of thing that must be a singleton, whoever owns the packages should declare it as a `peerDependency` rather than a regular dep, so the app decides the version and the installer warns loudly on mismatch instead of quietly duplicating.

For a monorepo specifically, a shared-version policy (syncpack, or just a lint rule) is worth setting up once so this doesn't recur every time someone adds a package.
