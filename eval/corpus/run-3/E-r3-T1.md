---
kind: eval-artifact
run: 3
variant: E
replicate: r3
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now want different versions of the same library, and only one version can win.

Here's what happens. The package manager tries to hoist a single copy of a shared dependency to the top of `node_modules`. When the version ranges overlap, it picks one copy and both packages use it. When the ranges don't overlap, it installs a second nested copy — and now you have two copies of the same library loaded at once.

That second copy is what breaks you. Type errors show up because TypeScript sees two distinct declarations of the same type. Runtime errors show up because `instanceof` checks fail across copies, and any library holding module-level state (React, a DI container, an event bus) now has two separate states that don't talk to each other.

**To diagnose it**, run:

```bash
pnpm why <library-name>
```

That prints every package pulling the library in and the version each one asked for. You'll see the conflict directly.

**To fix it**, pick one of these, in order of preference:

1. **Bump the lagging package** so both land on a compatible range. This is the real fix — do it if the newer version is safe to adopt.
2. **Add a `resolutions` / `pnpm.overrides` entry** in the root `package.json` to force one version for the whole tree. Fast, but you're asserting the older consumer works against the newer version. Test it.
3. **Make the library a peer dependency** of your internal packages instead of a direct one. That pushes the version choice to the app and stops packages from each dragging in their own copy. Do this for anything stateful — React, styling runtimes, state stores.

If the library is one we own, fix it there rather than adding an override here. An override in this repo helps this repo; a proper range in the library helps everyone.
