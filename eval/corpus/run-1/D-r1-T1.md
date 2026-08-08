---
kind: eval-artifact
run: 1
variant: D
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Short version: your build isn't broken because the new package is bad, it's broken because the dependency tree now has to hold two different versions of the same library at once, and something in your stack can't tolerate that.

What's actually happening under the hood: package managers install a *tree*, not a flat list. If package A wants `foo@^2` and package B wants `foo@^3`, there's no single version that satisfies both, so the installer gives up on sharing and nests a private copy — one `foo` at the top level and another tucked inside B's own `node_modules`. Both copies install fine. That's why `install` succeeds and only the build or the runtime complains.

Then one of three things bites you:

1. **Types disagree.** TypeScript sees `Foo` from v2 and `Foo` from v3 as two unrelated types even if they're identical character for character, because they come from different files on disk. You get errors like "Type `Foo` is not assignable to type `Foo`", which reads as nonsense until you know this is what's going on.
2. **Two instances of something that's supposed to be a singleton.** Anything with module-level state — React, a DI container, an event bus, an ORM's model registry — breaks badly when there are two copies. Each copy has its own state and they don't see each other. Classic symptom: "hooks can only be called inside a component" or a context that's mysteriously always undefined.
3. **Bundle bloat with no error at all.** Sometimes it just works and your bundle silently gained 200KB. Worth checking even when nothing is red.

**How to figure out which version came from where:**

```bash
pnpm why foo          # or: npm ls foo / yarn why foo
```

That prints the paths through the tree and shows you exactly who asked for what. Do this first — don't guess.

**How to fix it, roughly in order of preference:**

- **Just align the versions.** Bump whoever is behind so both packages want the same major. This is the real fix and usually takes ten minutes. Everything below is a workaround for when you can't do this.
- **Force a single version with an override.** In the root `package.json`, `pnpm.overrides` (or `resolutions` for yarn/npm `overrides`) lets you say "everyone gets `foo@3`, I don't care what they asked for." Fast and effective, but you're overruling a package's stated compatibility range — if v3 actually broke something that package uses, you now own that bug. Leave a comment saying why the override exists.
- **Make it a peer dependency.** If `foo` is the kind of library that *must* be a single instance (React, a state library, anything with a plugin registry), the packages that use it should list it in `peerDependencies` and not `dependencies`. That pushes the choice up to whoever installs them, and the package manager will warn loudly instead of quietly nesting a second copy. In a monorepo this is the right long-term shape for shared libs.

One thing to check before you do any of it: is the duplication actually the cause? Confirm with `pnpm why` that both versions are really present and that the failing import path traces back to one of them. Version skew is a very satisfying explanation and people sometimes "fix" it for an hour before discovering the build broke for an unrelated reason in the same commit.
