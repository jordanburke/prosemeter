---
kind: eval-artifact
run: 2
variant: G
replicate: r4
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for versions of the same library that the package manager cannot merge into one.

Here is what happens. Package A pins `lodash@^4`, package B pins `lodash@^5`, and the resolver cannot pick a single version that fits both. So it installs both copies, one at the top level and one nested inside the package that asked for the odd version. Your bundler then sees two copies of the same code.

That breaks builds in three ways:

- **Type errors.** TypeScript loads two sets of declarations, so `Thing` from copy 1 is not `Thing` from copy 2, even though the source is identical.
- **Runtime `instanceof` failures.** Each copy has its own class objects, so a value made by one copy fails a check written against the other.
- **Broken singletons.** Libraries that hold state, like React, a store, or a DI container, now hold two separate states.

Check what you have first:

```bash
pnpm why <library>      # or: npm ls <library>
```

That prints the tree and shows who asks for what.

Then fix it in this order.

**Bump the lagging package.** Look for a newer release of A that already moved to the version B wants. This is the real fix, since it leaves one copy in the tree and no override to maintain.

**Force one version if no such release exists.** Add an override in the root `package.json`:

```json
{
  "pnpm": { "overrides": { "lodash": "^5.0.0" } }
}
```

npm and yarn spell this `overrides` and `resolutions`. This lies to the resolver, so read the library's changelog first and confirm the old package still works on the new version. Leave a comment saying why the override is there and when it can go.

**Move the library to a peer dependency** if you own both packages. Peers let the app pick the version, and the resolver warns you instead of silently installing two copies. Do this for anything that must be a singleton.

One thing to rule out early: if this is a monorepo, run the install from the root, not from inside a package. A stale or package-local lockfile gives the same symptoms and costs a minute to check.
