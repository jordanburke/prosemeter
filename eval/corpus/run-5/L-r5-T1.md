---
kind: eval-artifact
run: 5
variant: L
replicate: r5
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages ask for different versions of the same library, and the package manager can no longer satisfy both with one copy. Pin the library to one version both packages accept, or let each keep its own copy.

## What is happening

Your package manager builds a single dependency tree. When two packages want the same library, it tries to give them one shared copy. It can do that only if their version ranges overlap.

The new package widened or moved the range. Say your package wants `^1.4.0` and theirs wants `^2.0.0`. No single version satisfies both. The manager now does one of two things, and both break builds.

It may install two copies, one nested under each package. Your code then holds two separate module instances. `instanceof` checks fail, singletons duplicate, and React throws "invalid hook call" when it sees two Reacts.

Or it may hoist one version and hand it to both. The package expecting the other version then calls a function that moved or changed shape, and you get a type error or a runtime crash.

## How to find it

Ask the manager to show you the tree:

```
npm ls <library>
pnpm why <library>
yarn why <library>
```

That prints every package that depends on the library and the version each one got. The duplicate is visible in the output.

## How to fix it

Pick the fix that matches what you found.

**Upgrade your side.** If your package can move to the newer range, do that. This is the real fix and it leaves no override to maintain.

**Ask the other team to widen or lower their range.** If the newer version buys them nothing, they can accept yours.

**Force one version.** If neither side can move today, override the resolution:

```jsonc
// package.json
"overrides": {          // npm
  "<library>": "2.1.0"
},
"pnpm": {               // pnpm
  "overrides": { "<library>": "2.1.0" }
},
"resolutions": {        // yarn
  "<library>": "2.1.0"
}
```

An override lies to one package about what it got. Test the loser hard, and leave a comment saying when the override can go.

**Let both copies live.** If the library holds no shared state — a date formatter, a string helper — two copies cost bundle size and nothing else. Stop fighting it and move on.

## What decides which fix

Ask whether the library carries identity or state. React, a database client, an event bus, anything with a registry or a context — those must be one copy, so you converge on a version. Pure functions do not care, so duplication is fine.

If the library must be one copy, the durable fix is a peer dependency. The library declares itself a peer, the app installs it once, and the package manager warns you the moment a version drifts.
