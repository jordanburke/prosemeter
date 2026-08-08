---
kind: eval-artifact
run: 5
variant: E
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because the package manager can no longer pick one version of that library that satisfies both packages. Pin a single version, or let the two versions coexist — which one you choose depends on whether the library's types or state have to be shared.

Here is what happens underneath. Package A asks for `lib@^1`. The new package B asks for `lib@^2`. npm and yarn try to hoist one copy to the top of `node_modules`. When one copy cannot satisfy both ranges, they install a nested second copy. Now two different `lib` objects exist in the same process.

That nesting is what breaks the build. Three symptoms give it away:

- **Type errors that make no sense.** TypeScript sees `Foo` from `lib@1` and `Foo` from `lib@2` as unrelated types, even when the fields match. The error reads "Type 'Foo' is not assignable to type 'Foo'".
- **`instanceof` returns false.** Each copy defines its own classes. An object built by one copy fails the check in the other.
- **Singletons split in two.** A library holding module-level state — a React context, a DI container, a plugin registry — now holds two of them. Whichever half your code reads is empty.

Bundle size also grows, but that is the mild version of the problem.

## How to see it

Run one of these:

```
npm ls lib
pnpm why lib
yarn why lib
```

The output shows every requester and the version each one got. Two version numbers in that tree confirms the diagnosis.

## How to fix it

Try these in order.

**Upgrade the older dependent.** If package A ships a release that accepts `lib@^2`, take it. This is the only fix that removes the duplication rather than papering over it, so try it first.

**Force one version.** Every manager has an override:

```json
// npm
"overrides": { "lib": "2.4.0" }

// pnpm
"pnpm": { "overrides": { "lib": "2.4.0" } }

// yarn
"resolutions": { "lib": "2.4.0" }
```

This works when the versions are compatible enough in practice — a major bump that only dropped a Node version, say. It fails loudly if package A really uses a removed API, which is better than failing subtly.

**Make the library a peer dependency.** If you own package A or B, move `lib` to `peerDependencies`. That makes the app pick the version, which is the right call for anything stateful.

**Leave both copies.** Sometimes two versions are fine. A pure utility with no shared state and no cross-package types can be duplicated safely. Accept the extra bytes and move on.

## Which one to pick

Ask whether the two packages ever pass `lib` values to each other. If they do, you must collapse to one version — no override-free path exists. If they never touch, duplication is harmless and the cheapest fix is to stop fighting it.

One warning about overrides. They apply to your whole tree and they are silent. Write a comment next to each one saying which conflict it resolves, or a teammate will delete it in six months and rediscover this bug.
