---
kind: eval-artifact
run: 2
variant: E
replicate: r5
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for different versions of the same library, and only one version can win at the point where they meet.

Package managers usually solve this by installing both copies, one nested under each dependent. That works fine until the library carries type declarations, a singleton, or an instance check. Then the two copies stop being interchangeable. TypeScript sees two different declarations of the same type and refuses to unify them. React sees two copies of itself and throws the hooks error. `instanceof` returns false against an object built by the other copy.

Find out which versions you actually have first:

```bash
pnpm why <library>
```

That prints every path that pulls the library in, with the version each path resolved to.

Then pick one of these fixes, in order of preference:

1. **Bump the lagging package** so both dependents land on the same range. This is the real fix. Do it when the newer version is compatible and the other team is willing.
2. **Add an override** to pin the library to one version across the whole tree:
   ```json
   "pnpm": { "overrides": { "<library>": "^5.2.0" } }
   ```
   Use this when you cannot bump yet. Write down why, because overrides hide real incompatibilities until they bite.
3. **Make the library a peer dependency** in any package you own. That pushes the version choice up to the app and stops the duplicate from appearing at all. This is the right shape for anything stateful — React, a logger, an ORM client.

Delete `node_modules` and the lockfile entry, reinstall, and re-run `pnpm why` to confirm one version remains.

One warning: if the two versions cross a major boundary, no amount of deduping saves you. One of the two call sites has to change.
